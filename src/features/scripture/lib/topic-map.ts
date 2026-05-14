export const TOPIC_MAP: Record<string, string> = {
    // Creation & Beginnings
    "creation story": "Genesis 1",
    "in the beginning": "Genesis 1",
    "adam and eve": "Genesis 2",
    "fall of man": "Genesis 3",
    "cain and abel": "Genesis 4",
    "noah's ark": "Genesis 6",
    "tower of babel": "Genesis 11",

    // Patriarchs
    "call of abram": "Genesis 12",
    "abraham and sarah": "Genesis 17",
    "sodom and gomorrah": "Genesis 19",
    "sacrifice of isaac": "Genesis 22",
    "jacob's ladder": "Genesis 28",
    "joseph and his brothers": "Genesis 37",
    "joseph in egypt": "Genesis 39",

    // Exodus & Law
    "burning bush": "Exodus 3",
    "ten plagues": "Exodus 7",
    "passover": "Exodus 12",
    "crossing the red sea": "Exodus 14",
    "ten commandments": "Exodus 20",
    "golden calf": "Exodus 32",

    // History & Kings
    "walls of jericho": "Joshua 6",
    "gideon's fleece": "Judges 6",
    "samson and delilah": "Judges 16",
    "ruth and boaz": "Ruth 3",
    "david and goliath": "1 Samuel 17",
    "david and bathsheba": "2 Samuel 11",
    "solomon's wisdom": "1 Kings 3",
    "elijah and the prophets of baal": "1 Kings 18",

    // Psalms & Wisdom
    "the lord is my shepherd": "Psalm 23",
    "create in me a clean heart": "Psalm 51",
    "proverbs 31 woman": "Proverbs 31",

    // Prophets
    "valley of dry bones": "Ezekiel 37",
    "fiery furnace": "Daniel 3",
    "daniel in the lions den": "Daniel 6",
    "jonah and the whale": "Jonah 1",

    // Jesus' Birth & Ministry
    "birth of jesus": "Luke 2",
    "sermon on the mount": "Matthew 5",
    "beatitudes": "Matthew 5",
    "lord's prayer": "Matthew 6",
    "golden rule": "Matthew 7:12",
    "good samaritan": "Luke 10",
    "prodigal son": "Luke 15",
    "feeding of the 5000": "Mark 6",
    "walking on water": "Matthew 14",
    "transfiguration": "Matthew 17",
    "lazarus raised from the dead": "John 11",
    "jesus wept": "John 11:35",

    // Passion & Resurrection
    "last supper": "Luke 22",
    "garden of gethsemane": "Matthew 26",
    "crucifixion": "Matthew 27",
    "resurrection": "Matthew 28",
    "road to emmaus": "Luke 24",
    "great commission": "Matthew 28:19",
    "ascension": "Acts 1",

    // Early Church
    "day of pentecost": "Acts 2",
    "conversion of saul": "Acts 9",
    "fruit of the spirit": "Galatians 5:22",
    "armor of god": "Ephesians 6",
    "hall of faith": "Hebrews 11",
    "love chapter": "1 Corinthians 13",
};

export function findTopicReference(transcript: string): string | null {
    const normalized = transcript.toLowerCase();

    for (const [topic, ref] of Object.entries(TOPIC_MAP)) {
        if (normalized.includes(topic)) {
            return ref;
        }
    }
    return null;
}
