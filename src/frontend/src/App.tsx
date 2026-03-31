import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  Check,
  Copy,
  Hand,
  Loader2,
  LogIn,
  LogOut,
  Play,
  Square,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useSaveUserProfile, useUserProfile } from "./hooks/useQueries";

const PLACEHOLDER = "Type or paste any text here\u2026";

type SignItem = { id: string; char: string };

function getIslImageUrl(char: string): string | null {
  const c = char.toLowerCase();
  if (/[a-z]/.test(c))
    return `https://www.lifeprint.com/asl101/fingerspelling/abc-gifs/${c}.gif`;
  return null;
}

function SignCard({ char }: { char: string }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const url = getIslImageUrl(char);

  if (char === " ") {
    return <div className="w-6" aria-label="space" />;
  }

  if (!url || imgError) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-16 h-16 rounded-2xl border border-border/40 bg-muted/60 flex items-center justify-center text-xs text-muted-foreground">
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
      whileHover={{ scale: 1.08 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center gap-1 cursor-default"
    >
      <div className="w-16 h-16 rounded-2xl border border-border/40 bg-muted/60 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200">
        {!loaded && <div className="w-full h-full bg-muted animate-pulse" />}
        <img
          src={url}
          alt={`ISL sign for ${char}`}
          className={`w-full h-full object-contain transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0 absolute"
          }`}
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

type ClassifyResult = { letter: string; confidence: number };

/**
 * ISL classifier using MediaPipe hand landmarks.
 * Confidence is computed by scoring each letter's geometric rules.
 * Normalized by hand size for scale-invariant recognition.
 */
function classifyISLLetter(lm: Landmark[]): ClassifyResult {
  if (!lm || lm.length < 21) return { letter: "?", confidence: 0 };

  // Normalize distances by hand size (wrist to middle-MCP)
  const handSize = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y) || 0.15;
  const nd = (a: number, b: number) =>
    Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y) / handSize;

  // Detect hand orientation: is pinky MCP to the right of index MCP?
  const isLeftHand = lm[17].x > lm[5].x;

  // Thumb direction: "out" means away from palm
  const thumbSideOut = isLeftHand ? lm[4].x > lm[3].x : lm[4].x < lm[3].x;
  const thumbUp = lm[4].y < lm[2].y - 0.01;

  // Finger extension: tip y < pip y = extended
  const idxExt = lm[8].y < lm[6].y;
  const midExt = lm[12].y < lm[10].y;
  const rngExt = lm[16].y < lm[14].y;
  const pkyExt = lm[20].y < lm[18].y;

  // Fully extended: tip significantly above MCP
  const idxFull = lm[5].y - lm[8].y > handSize * 0.35;
  const midFull = lm[9].y - lm[12].y > handSize * 0.35;
  const rngFull = lm[13].y - lm[16].y > handSize * 0.35;
  const pkyFull = lm[17].y - lm[20].y > handSize * 0.35;

  // Deeply curled: tip below its own MCP
  const idxDeep = lm[8].y > lm[5].y;
  const midDeep = lm[12].y > lm[9].y;
  const rngDeep = lm[16].y > lm[13].y;

  // Normalized key distances
  const dThumbIdx = nd(4, 8);
  const dThumbMid = nd(4, 12);
  const dThumbRng = nd(4, 16);
  const dIdxMid = nd(8, 12);
  const dIdxRng = nd(8, 16);
  void nd(12, 16); // dMidRng - computed but not used individually

  // Index horizontal: moving sideways more than vertically
  const idxHoriz = Math.abs(lm[8].x - lm[5].x) > Math.abs(lm[8].y - lm[5].y);
  const midHoriz = Math.abs(lm[12].x - lm[9].x) > Math.abs(lm[12].y - lm[9].y);

  const scores: Record<string, number> = {};

  scores.A =
    (!idxExt ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 20 : 0) +
    (thumbSideOut ? 15 : 0) +
    (!thumbUp ? 5 : 0) +
    (!idxDeep ? 5 : -5);

  scores.B =
    (idxFull ? 22 : 0) +
    (midFull ? 22 : 0) +
    (rngFull ? 22 : 0) +
    (pkyFull ? 22 : 0) +
    (!thumbSideOut ? 12 : 0);

  scores.C =
    (idxExt && !idxFull ? 15 : 0) +
    (midExt && !midFull ? 15 : 0) +
    (rngExt && !rngFull ? 15 : 0) +
    (pkyExt && !pkyFull ? 10 : 0) +
    (thumbSideOut ? 15 : 0) +
    (dThumbIdx > 0.25 && dThumbIdx < 0.7 ? 15 : 0) +
    (!thumbUp ? 15 : 0);

  scores.D =
    (idxFull ? 35 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 15 : 0) +
    (!pkyExt ? 10 : 0) +
    (dThumbMid < 0.35 ? 20 : 0);

  scores.E =
    (idxDeep ? 25 : 0) +
    (midDeep ? 25 : 0) +
    (rngDeep ? 25 : 0) +
    (!pkyExt ? 15 : 0) +
    (!thumbSideOut ? 10 : 0);

  scores.F =
    (dThumbIdx < 0.25 ? 35 : 0) +
    (midFull ? 20 : 0) +
    (rngFull ? 15 : 0) +
    (pkyFull ? 10 : 0) +
    (!idxFull ? 10 : 0) +
    (dIdxMid > 0.2 ? 10 : 0);

  scores.G =
    (idxExt ? 20 : 0) +
    (!midExt ? 25 : 0) +
    (!rngExt ? 25 : 0) +
    (!pkyExt ? 15 : 0) +
    (idxHoriz ? 25 : 0);

  scores.H =
    (idxExt ? 18 : 0) +
    (midExt ? 18 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 20 : 0) +
    (idxHoriz ? 12 : 0) +
    (midHoriz ? 12 : 0);

  scores.I =
    (!idxExt ? 25 : 0) +
    (!midExt ? 25 : 0) +
    (!rngExt ? 25 : 0) +
    (pkyFull ? 25 : 0);

  scores.J =
    (!idxExt ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (pkyFull ? 25 : 0) +
    (!thumbSideOut ? 15 : 0);

  scores.K =
    (idxFull ? 20 : 0) +
    (midFull ? 20 : 0) +
    (!rngExt ? 15 : 0) +
    (!pkyExt ? 15 : 0) +
    (thumbUp ? 20 : 0) +
    (nd(4, 6) < 0.4 ? 10 : 0);

  scores.L =
    (idxFull ? 35 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 15 : 0) +
    (thumbSideOut ? 10 : 0) +
    (!midDeep ? 5 : 0);

  scores.M =
    (idxDeep ? 25 : 0) +
    (midDeep ? 25 : 0) +
    (rngDeep ? 20 : 0) +
    (!pkyExt ? 15 : 0) +
    (thumbUp ? 15 : 0);

  scores.N =
    (idxDeep ? 28 : 0) +
    (midDeep ? 28 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 12 : 0) +
    (thumbUp ? 12 : 0);

  scores.O =
    (dThumbIdx < 0.22 ? 30 : 0) +
    (idxExt && !idxFull ? 15 : 0) +
    (midExt && !midFull ? 15 : 0) +
    (rngExt && !rngFull ? 10 : 0) +
    (dThumbMid < 0.3 ? 15 : 0) +
    (dThumbRng < 0.4 ? 15 : 0);

  scores.P =
    (lm[8].y > lm[0].y - 0.05 ? 25 : 0) +
    (idxExt ? 15 : 0) +
    (thumbSideOut ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 10 : 0) +
    (!pkyExt ? 10 : 0);

  scores.Q =
    (lm[8].y > lm[5].y - 0.02 ? 25 : 0) +
    (lm[4].y > lm[2].y ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 15 : 0);

  scores.R =
    (idxExt ? 20 : 0) +
    (midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 20 : 0) +
    (dIdxMid < 0.18 ? 20 : 0);

  scores.S =
    (!idxExt ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 20 : 0) +
    (lm[4].y < lm[8].y ? 20 : 0) +
    (!thumbSideOut ? 10 : 0) +
    (idxDeep ? 10 : 0);

  scores.T =
    (!idxExt ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 15 : 0) +
    (thumbUp ? 15 : 0) +
    (nd(4, 6) < 0.3 ? 15 : 0) +
    (!thumbSideOut ? 15 : 0);

  scores.U =
    (idxFull ? 22 : 0) +
    (midFull ? 22 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 16 : 0) +
    (dIdxMid < 0.22 ? 20 : 0);

  scores.V =
    (idxFull ? 22 : 0) +
    (midFull ? 22 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 16 : 0) +
    (dIdxMid > 0.28 ? 20 : 0);

  scores.W =
    (idxFull ? 20 : 0) +
    (midFull ? 20 : 0) +
    (rngFull ? 20 : 0) +
    (!pkyExt ? 20 : 0) +
    (dIdxRng > 0.25 ? 20 : 0);

  scores.X =
    (lm[7].y < lm[5].y && lm[8].y > lm[7].y ? 35 : 0) +
    (!idxFull ? 15 : 0) +
    (idxExt ? 10 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 10 : 0) +
    (!pkyExt ? 10 : 0);

  scores.Y =
    (!idxExt ? 20 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (pkyFull ? 20 : 0) +
    (thumbSideOut ? 20 : 0);

  scores.Z =
    (idxFull ? 25 : 0) +
    (!midExt ? 20 : 0) +
    (!rngExt ? 20 : 0) +
    (!pkyExt ? 15 : 0) +
    (Math.abs(lm[8].x - lm[5].x) > 0.03 ? 10 : 0) +
    (!thumbSideOut ? 10 : 0);

  let best = "A";
  let bestScore = -1;
  for (const [letter, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = letter;
    }
  }

  const confidence = Math.min(100, Math.round(bestScore));
  return { letter: best, confidence };
}

// Frame buffer + threshold logic
const FRAME_BUFFER_SIZE = 20;
const CONSISTENCY_THRESHOLD = 0.7;
const HOLD_MS = 600;
const COOLDOWN_MS = 500;

function SignToText() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const frameBufferRef = useRef<string[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef(false);
  const lastCapturedRef = useRef<string | null>(null);

  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [bufferConsistency, setBufferConsistency] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
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
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close?.();
      handsRef.current = null;
    }
    frameBufferRef.current = [];
    cooldownRef.current = false;
    setRunning(false);
    setCurrentLetter(null);
    setConfidence(0);
    setBufferConsistency(0);
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
      for (const lmk of landmarks) {
        ctx.beginPath();
        ctx.arc(lmk.x * canvas.width, lmk.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      const result = classifyISLLetter(landmarks);
      setCurrentLetter(result.letter);
      setConfidence(result.confidence);

      const buf = frameBufferRef.current;
      buf.push(result.letter);
      if (buf.length > FRAME_BUFFER_SIZE) buf.shift();

      const count = buf.filter((l) => l === result.letter).length;
      const consistency = buf.length > 0 ? count / buf.length : 0;
      setBufferConsistency(consistency);

      if (consistency >= CONSISTENCY_THRESHOLD && !cooldownRef.current) {
        if (
          !holdTimerRef.current ||
          lastCapturedRef.current !== result.letter
        ) {
          lastCapturedRef.current = result.letter;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            if (!cooldownRef.current) {
              setOutput((prev) => prev + result.letter);
              if (soundEnabledRef.current) {
                const utt = new SpeechSynthesisUtterance(result.letter);
                utt.rate = 1;
                utt.pitch = 1;
                utt.volume = 1;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utt);
              }
              cooldownRef.current = true;
              lastCapturedRef.current = null;
              frameBufferRef.current = [];
              setTimeout(() => {
                cooldownRef.current = false;
              }, COOLDOWN_MS);
            }
          }, HOLD_MS);
        }
      } else if (consistency < CONSISTENCY_THRESHOLD) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          lastCapturedRef.current = null;
        }
      }
    } else {
      setCurrentLetter(null);
      setConfidence(0);
      setBufferConsistency(0);
      frameBufferRef.current = [];
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        lastCapturedRef.current = null;
      }
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

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [output]);

  const isReady = bufferConsistency >= CONSISTENCY_THRESHOLD;

  const confColor =
    confidence >= 70
      ? "text-green-400"
      : confidence >= 50
        ? "text-amber-400"
        : "text-red-400";

  const barColor = isReady
    ? "bg-green-400"
    : bufferConsistency >= 0.4
      ? "bg-amber-400"
      : "bg-muted-foreground/30";

  return (
    <div className="bg-card rounded-2xl shadow-md border border-border p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">
        <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
          Sign Language
        </span>{" "}
        <span className="text-foreground">to Text</span>
      </h1>
      <p className="text-xs text-muted-foreground mb-6">
        Indian Sign Language (ISL) recognition with MediaPipe
      </p>

      {error ? (
        <div
          data-ocid="s2t.error_state"
          className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm p-4 mb-4"
        >
          {error}
        </div>
      ) : null}

      <div className="flex gap-4 flex-col sm:flex-row">
        {/* Camera Feed */}
        <div className="flex-1">
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
        </div>

        {/* Live Detection Panel — Dramatic Letter Pop */}
        {running && (
          <div
            className={`flex flex-col items-center justify-center min-w-[160px] gap-3 p-5 rounded-xl border-2 transition-colors duration-500 relative overflow-hidden ${
              isReady
                ? "border-green-400/60"
                : bufferConsistency >= 0.4
                  ? "border-amber-400/40"
                  : "border-border/40"
            } bg-black/40`}
          >
            {/* Radial glow behind letter */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${
                isReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(74,222,128,0.15) 0%, transparent 70%)",
              }}
            />

            {/* Animated letter */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLetter ?? "none"}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative z-10 text-center"
              >
                <div
                  className={`text-[8rem] font-extrabold font-mono leading-none select-none transition-colors duration-300 ${confColor}`}
                  style={{ filter: "drop-shadow(0 0 20px currentColor)" }}
                >
                  {currentLetter ?? "—"}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Score */}
            <div className={`text-sm font-semibold z-10 ${confColor}`}>
              {currentLetter ? `${confidence}%` : "—"}
            </div>

            {/* Bar */}
            <div className="w-full z-10">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors duration-300 ${barColor}`}
                  animate={{ width: `${bufferConsistency * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground text-center mt-1">
                {Math.round(bufferConsistency * 100)}% consistent
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground text-center z-10">
              Hold sign steady
              <br />
              for 0.6s to capture
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {!running ? (
          <Button
            data-ocid="s2t.primary_button"
            onClick={startCamera}
            className="rounded-full px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            Start
          </Button>
        ) : (
          <Button
            data-ocid="s2t.secondary_button"
            onClick={stopCamera}
            variant="secondary"
            className="rounded-full px-6 gap-2 hover:-translate-y-0.5 transition-all"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop
          </Button>
        )}
        <Button
          data-ocid="s2t.delete_button"
          onClick={() => setOutput("")}
          variant="outline"
          className="rounded-full px-5 gap-2 hover:-translate-y-0.5 transition-all"
          disabled={!output}
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
        <Button
          data-ocid="s2t.secondary_button"
          onClick={() => setOutput((prev) => `${prev} `)}
          variant="outline"
          className="rounded-full px-5 hover:-translate-y-0.5 transition-all text-sm"
        >
          + Space
        </Button>
        <Button
          data-ocid="s2t.delete_button"
          onClick={() => setOutput((prev) => prev.slice(0, -1))}
          variant="outline"
          className="rounded-full px-4 hover:-translate-y-0.5 transition-all text-sm"
          disabled={!output}
          title="Backspace"
        >
          ⌫
        </Button>
        <Button
          data-ocid="s2t.secondary_button"
          onClick={() => setSoundEnabled((p) => !p)}
          variant={soundEnabled ? "secondary" : "outline"}
          className="rounded-full px-4 hover:-translate-y-0.5 transition-all text-sm gap-1.5"
          title={
            soundEnabled
              ? "Sound On — click to mute"
              : "Sound Off — click to enable"
          }
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
          {soundEnabled ? "Sound On" : "Sound Off"}
        </Button>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="s2t-output"
            className="block text-sm font-semibold text-foreground"
          >
            Recognized Text
          </label>
          <Button
            data-ocid="s2t.secondary_button"
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            disabled={!output}
            className="h-7 px-3 gap-1.5 text-xs rounded-full hover:-translate-y-0.5 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </Button>
        </div>
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
        Supports A–Z in Indian Sign Language (ISL). Hold each sign steady for
        ~0.6s.
      </p>
    </div>
  );
}

// ─── Auth / Registration screens ────────────────────────────────────────────

function LoginScreen() {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center mb-4 shadow-lg">
            <Hand className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-foreground">SignBridge </span>
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              AI
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            ISL recognition · Text to Speech · Fingerspelling
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Welcome back
          </h2>
          <Button
            data-ocid="auth.primary_button"
            onClick={login}
            disabled={isLoggingIn || isInitializing}
            className="w-full rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all py-5 text-base font-semibold"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isLoggingIn ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function RegisterScreen({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const { mutate: saveProfile, isPending, isError } = useSaveUserProfile();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !email.trim()) return;
      saveProfile(
        { username: username.trim(), email: email.trim() },
        { onSuccess: onDone },
      );
    },
    [username, email, saveProfile, onDone],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center mb-4 shadow-lg">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Create your profile
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Almost there! Just a few details.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reg-username" className="text-sm font-semibold">
                Username
              </Label>
              <Input
                id="reg-username"
                data-ocid="register.input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. shreyaa"
                className="rounded-xl border-border focus-visible:ring-primary"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-sm font-semibold">
                Email
              </Label>
              <Input
                id="reg-email"
                data-ocid="register.input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl border-border focus-visible:ring-primary"
                required
              />
            </div>

            {isError && (
              <p
                data-ocid="register.error_state"
                className="text-xs text-destructive"
              >
                Failed to save profile. Please try again.
              </p>
            )}

            <Button
              data-ocid="register.submit_button"
              type="submit"
              disabled={isPending || !username.trim() || !email.trim()}
              className="w-full rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all py-5 text-base font-semibold"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {isPending ? "Saving..." : "Create Profile"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

function MainApp() {
  const { clear, identity } = useInternetIdentity();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const [showRegister, setShowRegister] = useState(false);

  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [signItems, setSignItems] = useState<SignItem[]>([]);
  const [converted, setConverted] = useState(false);
  const [activeTab, setActiveTab] = useState("voice");
  const [speechRate, setSpeechRate] = useState(1.0);

  useEffect(() => {
    if (!profileLoading && identity && profile === null) {
      setShowRegister(true);
    } else if (profile) {
      setShowRegister(false);
    }
  }, [profile, profileLoading, identity]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleSpeak = useCallback(() => {
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [text, speechRate]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const handleConvert = useCallback(() => {
    setSignItems(makeSignItems(text));
    setConverted(true);
  }, [text]);

  if (showRegister) {
    return <RegisterScreen onDone={() => setShowRegister(false)} />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-border bg-gradient-to-r from-card via-card to-primary/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
              <Hand className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              SignBridge{" "}
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                AI
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <span className="text-xs font-medium text-muted-foreground hidden sm:block bg-muted px-3 py-1.5 rounded-full">
                Hello, {profile.username}
              </span>
            )}
            <Button
              data-ocid="auth.secondary_button"
              onClick={clear}
              variant="ghost"
              size="sm"
              className="gap-2 text-xs rounded-full px-3 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[740px]"
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList
              data-ocid="tools.tab"
              className="mb-6 rounded-full bg-muted p-1 h-auto flex-wrap gap-1 w-full"
            >
              <TabsTrigger
                value="voice"
                data-ocid="tools.voice.tab"
                className="rounded-full gap-2 flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
              >
                <Volume2 className="w-4 h-4" />
                Text to Voice
              </TabsTrigger>
              <TabsTrigger
                value="sign"
                data-ocid="tools.sign.tab"
                className="rounded-full gap-2 flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
              >
                <Hand className="w-4 h-4" />
                Sign Language
              </TabsTrigger>
              <TabsTrigger
                value="sign2text"
                data-ocid="tools.sign2text.tab"
                className="rounded-full gap-2 flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
              >
                <Camera className="w-4 h-4" />
                Sign to Text
              </TabsTrigger>
            </TabsList>

            {/* Text to Voice Tab */}
            <TabsContent value="voice">
              <div className="bg-gradient-to-b from-card to-card/80 rounded-2xl shadow-md border border-border p-6 sm:p-10">
                <h1 className="text-2xl font-extrabold tracking-tight mb-5">
                  <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                    Turn Text
                  </span>{" "}
                  <span className="text-foreground">into Voice</span>
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
                {wordCount > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </p>
                )}

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="tts-speed"
                      className="text-sm font-medium text-foreground"
                    >
                      Speed
                    </label>
                    <span className="text-sm font-semibold text-primary">
                      {speechRate.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    id="tts-speed"
                    data-ocid="tts.toggle"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={[speechRate]}
                    onValueChange={([val]) => setSpeechRate(val)}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-muted-foreground">
                      0.5x
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      2.0x
                    </span>
                  </div>
                </div>

                {speaking && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Speaking…
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <Button
                    data-ocid="tts.primary_button"
                    onClick={handleSpeak}
                    disabled={speaking || !text.trim()}
                    className="rounded-full px-7 py-5 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all font-semibold"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Speak
                  </Button>
                  <Button
                    data-ocid="tts.secondary_button"
                    onClick={handleStop}
                    disabled={!speaking}
                    variant="secondary"
                    className="rounded-full px-7 py-5 gap-2 hover:-translate-y-0.5 transition-all"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sign Language Tab */}
            <TabsContent value="sign">
              <div className="bg-gradient-to-b from-card to-card/80 rounded-2xl shadow-md border border-border p-6 sm:p-10">
                <h1 className="text-2xl font-extrabold tracking-tight mb-5">
                  <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                    Turn Text
                  </span>{" "}
                  <span className="text-foreground">into Sign Language</span>
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

                <div className="mt-5">
                  <Button
                    data-ocid="sign.primary_button"
                    onClick={handleConvert}
                    disabled={!text.trim()}
                    className="rounded-full px-7 py-5 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all font-semibold"
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
                          className="flex flex-wrap gap-4 p-5 bg-muted/30 rounded-xl border border-border/60"
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

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!identity) {
    return <LoginScreen />;
  }

  return <MainApp />;
}
