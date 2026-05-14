import os
import io
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper Model
# 'tiny' or 'base' is good for real-time. 'small' or 'medium' for better accuracy but slower.
# Run on CPU by default to be safe, or "cuda" if available.
model_size = "base.en"
print(f"Loading Whisper model ({model_size})...")
model = WhisperModel(model_size, device="cpu", compute_type="int8")
print("Whisper model loaded.")

@app.get("/")
async def root():
    return {"status": "ok", "message": "Fast Whisper Server Running"}

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket")
    
    try:
        while True:
            # Receive audio blob
            data = await websocket.receive_bytes()
            
            # Process audio chunk
            # Whisper expects a file-like object or path
            audio_io = io.BytesIO(data)
            
            # Transcribe
            # Optimizations for Real-Time:
            # - beam_size=1 (Greedy decoding, much faster)
            # - temperature=0.0 (Deterministic)
            # - condition_on_previous_text=False (Prevents hallucinations from previous chunks)
            # - initial_prompt (Biases model towards Bible context)
            segments, info = model.transcribe(
                audio_io, 
                beam_size=1, 
                temperature=0.0,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                condition_on_previous_text=False,
                initial_prompt="The Holy Bible. Scripture reading. Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth 1 Samuel 2 Samuel."
            )
            
            # Additional Hallucination Filters
            hallucinations = [
                "Thank you for watching", 
                "Subtitle by", 
                "Amara.org", 
                "MBC", 
                "Copyright",
                "See you next week"
            ]

            valid_segments = []
            for segment in segments:
                # Filter out low probability segments or hallucinations
                if segment.no_speech_prob > 0.4 or segment.avg_logprob < -1.0:
                    continue
                
                text = segment.text.strip()
                if not text:
                    continue
                    
                is_hallucination = any(h.lower() in text.lower() for h in hallucinations)
                if not is_hallucination:
                    valid_segments.append(text)

            transcription = " ".join(valid_segments).strip()
            
            if transcription:
                print(f"Transcribed: {transcription} (Prob: {info.language_probability:.2f})")
                await websocket.send_json({
                    "text": transcription,
                    "language": info.language,
                    "probability": info.language_probability
                })
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)
