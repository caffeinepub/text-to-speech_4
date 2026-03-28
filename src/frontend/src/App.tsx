import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Hand, Play, Square, Trash2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDER = "Type or paste any text here\u2026";

type SignItem = { id: string; char: string };

function getAslImageUrl(char: string): string | null {
  const c = char.toLowerCase();
  if (/[a-z]/.test(c))
    return `https://www.lifeprint.com/asl101/fingerspelling/abc-gifs/${c}.gif`;
  if (/[0-9]/.test(c))
    return `https://www.lifeprint.com/asl101/fingerspelling/abc-gifs/${c}.gif`;
  return null;
}

function SignCard({ char }: { char: string }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const url = getAslImageUrl(char);

  if (char === " ") {
    return <div className="w-6" aria-label="space" />;
  }

  if (!url || imgError) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-14 h-14 rounded-xl border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          ?
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          {char}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center gap-1"
    >
      <div className="w-14 h-14 rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
        {!loaded && <div className="w-full h-full bg-muted animate-pulse" />}
        <img
          src={url}
          alt={`ASL sign for ${char}`}
          className={`w-full h-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0 absolute"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      </div>
      <span className="text-[11px] font-semibold text-foreground uppercase">
        {char}
      </span>
    </motion.div>
  );
}

let idCounter = 0;
function makeSignItems(text: string): SignItem[] {
  return text.split("").map((char) => ({ id: String(++idCounter), char }));
}

type Landmark = { x: number; y: number; z: number };

function classifyASL(landmarks: Landmark[]): string | null {
  const isExtended = (tip: number, mcp: number) =>
    landmarks[tip].y < landmarks[mcp].y;
  const thumb = landmarks[4].x < landmarks[3].x;
  const index = isExtended(8, 5);
  const middle = isExtended(12, 9);
  const ring = isExtended(16, 13);
  const pinky = isExtended(20, 17);

  if (!index && !middle && !ring && !pinky && !thumb) return "A";
  if (index && middle && ring && pinky && !thumb) return "B";
  if (!index && !middle && !ring && !pinky && thumb) return "C";
  if (index && !middle && !ring && !pinky) return "D";
  if (index && middle && !ring && !pinky && !thumb) return "V";
  if (index && middle && ring && !pinky) return "W";
  if (!index && !middle && !ring && pinky) return "I";
  if (index && !middle && !ring && pinky) return "U";
  if (index && middle && ring && pinky && thumb) return "B";
  return null;
}

function SignToText() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastLetterRef = useRef<string | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediapipeReady, setMediapipeReady] = useState(false);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if ((window as any).Hands) {
        setMediapipeReady(true);
        clearInterval(checkInterval);
      }
    }, 500);
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!(window as any).Hands) {
        setError(
          "Hand detection unavailable. Please check your internet connection.",
        );
      }
    }, 8000);
    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) {
        t.stop();
      }
      streamRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close?.();
      handsRef.current = null;
    }
    setRunning(false);
  }, []);

  const onHandResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks: Landmark[] = results.multiHandLandmarks[0];

      ctx.fillStyle = "rgba(99,102,241,0.9)";
      for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      const letter = classifyASL(landmarks);
      if (letter) {
        if (letter !== lastLetterRef.current) {
          lastLetterRef.current = letter;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            setOutput((prev) => prev + letter);
          }, 1000);
        }
      } else {
        lastLetterRef.current = null;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      }
    } else {
      lastLetterRef.current = null;
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!(window as any).Hands) {
      setError(
        "Hand detection unavailable. Please check your internet connection.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const hands = new (window as any).Hands({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });
      hands.onResults(onHandResults);
      handsRef.current = hands;

      const processFrame = async () => {
        if (videoRef.current && handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
        animFrameRef.current = requestAnimationFrame(processFrame);
      };
      animFrameRef.current = requestAnimationFrame(processFrame);
      setRunning(true);
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, [onHandResults]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-5">
        Sign Language to <span className="text-primary">Text</span>
      </h1>

      {error ? (
        <div
          data-ocid="s2t.error_state"
          className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm p-4 mb-4"
        >
          {error}
        </div>
      ) : null}

      <div
        className="relative w-full rounded-xl overflow-hidden bg-black"
        style={{ aspectRatio: "4/3" }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white/70">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {mediapipeReady
                  ? "Press Start to begin"
                  : "Loading hand detection..."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        {!running ? (
          <Button
            data-ocid="s2t.primary_button"
            onClick={startCamera}
            className="rounded-full px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Start
          </Button>
        ) : (
          <Button
            data-ocid="s2t.secondary_button"
            onClick={stopCamera}
            variant="secondary"
            className="rounded-full px-6 gap-2 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop
          </Button>
        )}
        <Button
          data-ocid="s2t.delete_button"
          onClick={() => setOutput("")}
          variant="outline"
          className="rounded-full px-6 gap-2 transition-colors"
          disabled={!output}
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>

      <div className="mt-5">
        <label
          htmlFor="s2t-output"
          className="block text-sm font-semibold text-foreground mb-2"
        >
          Recognized Text
        </label>
        <Textarea
          id="s2t-output"
          data-ocid="s2t.textarea"
          value={output}
          readOnly
          placeholder="Recognized letters will appear here as you sign\u2026"
          rows={4}
          className="resize-none text-sm text-foreground placeholder:text-muted-foreground border-border rounded-xl focus-visible:ring-primary font-mono tracking-widest"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Hold each sign steady for ~1 second to register the letter. Supports: A,
        B, C, D, I, U, V, W.
      </p>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [signItems, setSignItems] = useState<SignItem[]>([]);
  const [converted, setConverted] = useState(false);
  const [activeTab, setActiveTab] = useState("voice");

  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val);
  }, []);

  const handleSpeak = useCallback(() => {
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [text]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const handleConvert = useCallback(() => {
    setSignItems(makeSignItems(text));
    setConverted(true);
  }, [text]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          <span className="text-base font-semibold text-foreground tracking-tight">
            SignBridge AI
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[700px]"
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList
              data-ocid="tools.tab"
              className="mb-5 rounded-xl bg-muted p-1 h-auto flex-wrap gap-1"
            >
              <TabsTrigger
                value="voice"
                data-ocid="tools.voice.tab"
                className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Volume2 className="w-4 h-4" />
                Text to Voice
              </TabsTrigger>
              <TabsTrigger
                value="sign"
                data-ocid="tools.sign.tab"
                className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Hand className="w-4 h-4" />
                Sign Language
              </TabsTrigger>
              <TabsTrigger
                value="sign2text"
                data-ocid="tools.sign2text.tab"
                className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Camera className="w-4 h-4" />
                Sign to Text
              </TabsTrigger>
            </TabsList>

            {/* Text to Voice Tab */}
            <TabsContent value="voice">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-5">
                  Turn Text into <span className="text-primary">Voice</span>
                </h1>
                <label
                  htmlFor="tts-input"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Your Text
                </label>
                <Textarea
                  id="tts-input"
                  data-ocid="tts.textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={6}
                  className="resize-none text-sm text-foreground placeholder:text-muted-foreground border-border rounded-xl focus-visible:ring-primary"
                />

                {speaking && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Speaking\u2026
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <Button
                    data-ocid="tts.primary_button"
                    onClick={handleSpeak}
                    disabled={speaking || !text.trim()}
                    className="rounded-full px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Speak
                  </Button>
                  <Button
                    data-ocid="tts.secondary_button"
                    onClick={handleStop}
                    disabled={!speaking}
                    variant="secondary"
                    className="rounded-full px-6 gap-2 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sign Language Tab */}
            <TabsContent value="sign">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-5">
                  Turn Text into{" "}
                  <span className="text-primary">Sign Language</span>
                </h1>
                <label
                  htmlFor="sign-input"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Your Text
                </label>
                <Textarea
                  id="sign-input"
                  data-ocid="sign.textarea"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setConverted(false);
                  }}
                  placeholder={PLACEHOLDER}
                  rows={4}
                  className="resize-none text-sm text-foreground placeholder:text-muted-foreground border-border rounded-xl focus-visible:ring-primary"
                />

                <div className="mt-4">
                  <Button
                    data-ocid="sign.primary_button"
                    onClick={handleConvert}
                    disabled={!text.trim()}
                    className="rounded-full px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Hand className="w-4 h-4" />
                    Convert to Signs
                  </Button>
                </div>

                <AnimatePresence mode="wait">
                  {converted && (
                    <motion.div
                      key="sign-output"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-6"
                    >
                      {signItems.length === 0 ||
                      signItems.every((s) => s.char === " ") ? (
                        <div
                          data-ocid="sign.empty_state"
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No characters to display.
                        </div>
                      ) : (
                        <div
                          data-ocid="sign.panel"
                          className="flex flex-wrap gap-3 p-4 bg-muted/40 rounded-xl border border-border"
                        >
                          {signItems.map((item) => (
                            <SignCard key={item.id} char={item.char} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* Sign to Text Tab */}
            <TabsContent value="sign2text">
              <SignToText />
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
