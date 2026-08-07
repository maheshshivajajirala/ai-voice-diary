"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setEntries(data);
  };

  const startVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      await processAndSaveEntry(text);
    };

    recognition.start();
  };

  const processAndSaveEntry = async (rawTranscript: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/process-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: rawTranscript, language }),
      });

      const data = await res.json();

      if (data.cleanTranscript && data.category) {
        await supabase.from("entries").insert([
          {
            original_transcript: rawTranscript,
            clean_transcript: data.cleanTranscript,
            category: data.category,
            language: language,
          },
        ]);
        fetchEntries();
      }
    } catch (err) {
      console.error("Error processing entry:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6 font-sans">
      <h1 className="text-3xl font-bold text-center">AI Voice Diary</h1>

      <div className="flex flex-col items-center gap-4 border p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="en-US">English</option>
          <option value="es-ES">Spanish</option>
          <option value="fr-FR">French</option>
          <option value="hi-IN">Hindi</option>
          <option value="te-IN">Telugu</option>
        </select>

        <button
          onClick={startVoiceRecording}
          disabled={isRecording || loading}
          className={`px-6 py-3 rounded-full text-white font-semibold ${
            isRecording ? "bg-red-500 animate-pulse" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isRecording ? "Listening..." : loading ? "Processing..." : "Start Recording"}
        </button>

        {transcript && (
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
            "{transcript}"
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Entries</h2>
        {entries.length === 0 ? (
          <p className="text-gray-500">No entries yet. Speak into the mic to start!</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-medium">
                  {entry.category}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-800 dark:text-gray-200">{entry.clean_transcript}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
      }

