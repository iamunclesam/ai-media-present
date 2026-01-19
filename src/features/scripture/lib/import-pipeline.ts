import { unzipSync } from "fflate";
import { db, type BibleVerse, type BibleVersion } from "./db";

export type ImportProgress = {
  phase: "downloading" | "unzipping" | "parsing" | "importing";
  percent: number;
};

export async function importBibleModule(
  url: string,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  // 1. Download
  onProgress({ phase: "downloading", percent: 0 });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Could not get reader from response");

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) {
      onProgress({ phase: "downloading", percent: Math.round((loaded / total) * 100) });
    }
  }

  const blob = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    blob.set(chunk, offset);
    offset += chunk.length;
  }

  await processBibleBuffer(blob, onProgress);
}

export async function processBibleBuffer(
  buffer: Uint8Array,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  // 2. Unzip (if it's a zip, otherwise assume it's raw JSON/XML)
  let fileContent: string;
  let fileName: string | undefined;

  onProgress({ phase: "unzipping", percent: 0 });
  
  try {
    const unzipped = unzipSync(buffer);
    fileName = Object.keys(unzipped).find(
      (name) => name.endsWith(".json") || name.endsWith(".xml")
    );
    if (!fileName) throw new Error("No valid Bible file (JSON/XML) found in ZIP");
    fileContent = new TextDecoder().decode(unzipped[fileName]);
    onProgress({ phase: "unzipping", percent: 100 });
  } catch (e) {
    // Not a zip, try to parse as direct file
    fileContent = new TextDecoder().decode(buffer);
    // Simple heuristic to detect JSON vs XML
    fileName = fileContent.trim().startsWith("{") ? "bible.json" : "bible.xml";
    onProgress({ phase: "unzipping", percent: 100 });
  }

  // 3. Parse & Import
  if (fileName.endsWith(".json")) {
    await importFromJson(fileContent, onProgress, fileName);
  } else {
    await importFromXml(fileContent, onProgress, fileName);
  }
}

async function importFromJson(
  content: string,
  onProgress: (progress: ImportProgress) => void,
  defaultName: string
) {
  onProgress({ phase: "parsing", percent: 100 });
  const data = JSON.parse(content);
  const bibleName = data.version?.name || defaultName.split(".")[0].replace(/[_-]/g, " ");
  const version: BibleVersion = {
    ...data.version,
    name: bibleName,
    id: data.version?.id || bibleName.toLowerCase().replace(/\s+/g, "-"),
    lastUpdated: Date.now(),
    size: content.length,
  };

  const verses: BibleVerse[] = data.verses.map((v: any) => ({
    pk: `${version.id}|${v.bookId}|${v.chapter}|${v.verse}`,
    version: version.id,
    ...v,
  }));

  const books: any[] = data.books || [];
  await performBatchImport(version, verses, onProgress, books);
}

async function importFromXml(
  content: string,
  onProgress: (progress: ImportProgress) => void,
  defaultName: string
) {
  onProgress({ phase: "parsing", percent: 0 });
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "text/xml");
  
  // Robust name extraction
  const root = xmlDoc.documentElement;
  const fileNameBase = defaultName.split(".")[0];
  const bibleName = root.getAttribute("name") || 
                    root.getAttribute("title") || 
                    root.getAttribute("n") ||
                    fileNameBase.replace(/[_-]/g, " ");

  const bibleId = bibleName.toLowerCase().replace(/\s+/g, "-");
  
  // Try to get code from attributes, or filename if it's short (2-5 chars), or first 3 of name
  let bibleCode = root.getAttribute("abbreviation") || 
                  root.getAttribute("shortName") || 
                  root.getAttribute("code");
  
  if (!bibleCode) {
    if (fileNameBase.length >= 2 && fileNameBase.length <= 5) {
      bibleCode = fileNameBase.toUpperCase();
    } else {
      bibleCode = bibleName.toUpperCase().substring(0, 3);
    }
  }

  const version: BibleVersion = {
    id: bibleId,
    name: bibleName,
    code: bibleCode.toUpperCase(),
    lastUpdated: Date.now(),
    size: content.length,
  };

  const verses: BibleVerse[] = [];
  const books: any[] = [];
  
  // Support both <BOOK> and <b>
  const bookNodes = xmlDoc.getElementsByTagName("BOOK").length > 0 
    ? xmlDoc.getElementsByTagName("BOOK") 
    : xmlDoc.getElementsByTagName("b");
  
  for (let i = 0; i < bookNodes.length; i++) {
    const bookNode = bookNodes[i];
    // Support name, title or n attribute
    const bookName = bookNode.getAttribute("name") || 
                     bookNode.getAttribute("title") || 
                     bookNode.getAttribute("n") || "";
    
    const bookAbbr = bookNode.getAttribute("abbreviation") || 
                     bookNode.getAttribute("shortName") || "";
    
    const bookId = bookName.toLowerCase().replace(/\s+/g, "").substring(0, 8);
    
    let maxChapter = 0;
    
    // Support <CHAPTER> and <c>
    const chapterNodes = bookNode.getElementsByTagName("CHAPTER").length > 0 
      ? bookNode.getElementsByTagName("CHAPTER") 
      : bookNode.getElementsByTagName("c");

    for (let j = 0; j < chapterNodes.length; j++) {
      const chapterNode = chapterNodes[j];
      const chapterNum = parseInt(chapterNode.getAttribute("number") || chapterNode.getAttribute("n") || "0", 10);
      if (chapterNum > maxChapter) maxChapter = chapterNum;
      
      // Support <VERSE> and <v>
      const verseNodes = chapterNode.getElementsByTagName("VERSE").length > 0 
        ? chapterNode.getElementsByTagName("VERSE") 
        : chapterNode.getElementsByTagName("v");

      for (let k = 0; k < verseNodes.length; k++) {
        const verseNode = verseNodes[k];
        const verseNum = parseInt(verseNode.getAttribute("number") || verseNode.getAttribute("n") || "0", 10);
        const text = verseNode.textContent || "";
        
        verses.push({
          pk: `${version.id}|${bookId}|${chapterNum}|${verseNum}`,
          version: version.id,
          bookId,
          bookName,
          chapter: chapterNum,
          verse: verseNum,
          text,
        });
      }
    }

    books.push({
      pk: `${version.id}|${bookId}`,
      version: version.id,
      id: bookId,
      name: bookName,
      abbreviation: bookAbbr,
      chapters: maxChapter,
    });

    onProgress({ phase: "parsing", percent: Math.round(((i + 1) / bookNodes.length) * 100) });
  }

  await performBatchImport(version, verses, onProgress, books);
}

async function performBatchImport(
  version: BibleVersion,
  verses: BibleVerse[],
  onProgress: (progress: ImportProgress) => void,
  books: any[]
) {
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(verses.length / BATCH_SIZE);

  await db.transaction("readwrite", [db.versions, db.verses, db.books], async () => {
    await db.versions.put(version);
    await db.books.where("version").equals(version.id).delete();
    await db.verses.where("version").equals(version.id).delete();

    if (books.length > 0) {
      await db.books.bulkAdd(books);
    }

    for (let i = 0; i < totalBatches; i++) {
      const batch = verses.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      await db.verses.bulkAdd(batch);
      onProgress({ 
        phase: "importing", 
        percent: Math.round(((i + 1) / totalBatches) * 100) 
      });
    }
  });
}
