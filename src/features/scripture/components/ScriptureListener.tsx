"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ScriptureListenerProps {
    onTranscript: (text: string) => void;
    isListening?: boolean;
}

export function ScriptureListener({ onTranscript }: ScriptureListenerProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // We use refs to safely access state in callbacks/timeouts without stale closures
    const isRecordingRef = useRef(false);
    const socketRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null); // Keep track of current recorder

    const cleanup = useCallback(() => {
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsConnected(false);

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const recordSlice = (stream: MediaStream, ws: WebSocket) => {
        if (!isRecordingRef.current || ws.readyState !== WebSocket.OPEN) return;

        try {
            const mimeType = MediaRecorder.isTypeSupported("audio/webm")
                ? "audio/webm"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : ""; // Let browser choose default if neither is explicitly supported

            const options = mimeType ? { mimeType } : undefined;
            const recorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                    ws.send(event.data);
                }
            };

            recorder.onstop = () => {
                // Determine if we should continue recording
                if (isRecordingRef.current && ws.readyState === WebSocket.OPEN) {
                    // Slight delay to prevent tight loop if something errors immediately
                    setTimeout(() => recordSlice(stream, ws), 100);
                }
            };

            recorder.start();

            // Stop this slice after 3 seconds to ensure we send a complete file with headers
            setTimeout(() => {
                if (recorder.state === "recording") {
                    recorder.stop();
                }
            }, 3000);
        } catch (e) {
            console.error("Recorder Error:", e);
            cleanup();
        }
    };

    const startRecording = async () => {
        if (socketRef.current || isRecordingRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const ws = new WebSocket("ws://localhost:4000/ws/transcribe");

            ws.onopen = () => {
                console.log("Connected to Whisper Server");
                setIsConnected(true);
                setIsRecording(true);
                isRecordingRef.current = true;

                // Start the recording loop
                recordSlice(stream, ws);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.text) {
                    onTranscript(data.text);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket Error:", error);
                toast.error("Failed to connect to Whisper server (Port 4000).");
                cleanup();
            };

            ws.onclose = () => {
                console.log("Disconnected from Whisper Server");
                if (isRecordingRef.current) {
                    toast.error("Disconnected from server.");
                }
                cleanup();
            };

            socketRef.current = ws;

        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("Could not access microphone.");
            cleanup();
        }
    };

    const stopRecording = () => {
        cleanup();
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    return (
        <Button
            variant={isRecording ? "destructive" : "secondary"}
            size="sm"
            className={cn("gap-2 transition-all", isRecording && "animate-pulse")}
            onClick={toggleRecording}
        >
            {isRecording ? (
                <>
                    <MicOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Stop Listening</span>
                </>
            ) : (
                <>
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline">AI Listen</span>
                </>
            )}
        </Button>
    );
}
