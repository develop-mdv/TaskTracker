"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canvasToPng, copyPng, downloadBlob } from "@/lib/attachments-client";

type Point = { x: number; y: number };
type Stroke = {
  color: string;
  width: number;
  points: Point[];
  eraser: boolean;
};
const WIDTH = 1200;
const HEIGHT = 750;
const COLORS = [
  "#1e293b",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  context.strokeStyle = stroke.eraser ? "#ffffff" : stroke.color;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (!rest.length) {
    context.beginPath();
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }
}

export function SketchModal({
  onClose,
  onAttach,
  initialImage,
}: {
  onClose: () => void;
  onAttach: (file: File) => Promise<void>;
  initialImage?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [history, setHistory] = useState<Stroke[]>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!initialImage);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dirty, setDirty] = useState(false);

  const repaint = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (imageRef.current) {
      const img = imageRef.current;
      const scale = Math.min(
        WIDTH / img.naturalWidth,
        HEIGHT / img.naturalHeight,
      );
      const width = img.naturalWidth * scale,
        height = img.naturalHeight * scale;
      context.drawImage(
        img,
        (WIDTH - width) / 2,
        (HEIGHT - height) / 2,
        width,
        height,
      );
    }
    for (const stroke of strokesRef.current) paintStroke(context, stroke);
    if (currentRef.current) paintStroke(context, currentRef.current);
  }, []);

  useEffect(() => {
    repaint();
    if (!initialImage) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) {
        imageRef.current = image;
        setLoading(false);
        repaint();
      }
    };
    image.onerror = () => {
      if (active) {
        setLoading(false);
        setError("Не удалось открыть картинку");
      }
    };
    image.src = initialImage;
    return () => {
      active = false;
    };
  }, [initialImage, repaint]);

  const close = useCallback(() => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }, [busy, dirty, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * WIDTH) / bounds.width,
      y: ((event.clientY - bounds.top) * HEIGHT) / bounds.height,
    };
  };

  const finishStroke = () => {
    if (!currentRef.current) return;
    const next = [...strokesRef.current, currentRef.current];
    strokesRef.current = next;
    currentRef.current = null;
    pointerRef.current = null;
    setHistory(next);
    setRedo([]);
    setDirty(true);
    repaint();
  };

  const action = async (kind: "copy" | "download" | "attach") => {
    if (!canvasRef.current || busy || loading) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const png = canvasToPng(canvasRef.current);
      if (kind === "copy") {
        await copyPng(png);
        setMessage("Картинка скопирована");
      } else {
        const blob = await png;
        const filename = `Зарисовка-${Date.now()}.png`;
        if (kind === "download") {
          downloadBlob(blob, filename);
          setMessage("PNG скачан");
        } else {
          await onAttach(new File([blob], filename, { type: "image/png" }));
          onClose();
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить зарисовку",
      );
    } finally {
      setBusy(false);
    }
  };

  const button =
    "min-h-10 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-40";
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sketch-title"
        tabIndex={-1}
        className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const fields = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            );
            if (!fields?.length) return;
            const first = fields[0],
              last = fields[fields.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialogRef.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialogRef.current)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
          <div>
            <h2 id="sketch-title" className="font-semibold text-white">
              Холст для зарисовки
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Рисуйте мышью, пальцем или стилусом
            </p>
          </div>
          <button
            aria-label="Закрыть холст"
            onClick={close}
            disabled={busy}
            className={button}
          >
            ✕
          </button>
        </div>
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6"
          role="toolbar"
          aria-label="Инструменты рисования"
        >
          <button
            aria-pressed={!eraser}
            onClick={() => setEraser(false)}
            className={`${button} ${!eraser ? "border-amber-500 text-amber-300" : ""}`}
          >
            Перо
          </button>
          <button
            aria-pressed={eraser}
            onClick={() => setEraser(true)}
            className={`${button} ${eraser ? "border-amber-500 text-amber-300" : ""}`}
          >
            Ластик
          </button>
          <div className="flex items-center gap-1.5 px-1">
            {COLORS.map((value) => (
              <button
                key={value}
                aria-label={`Цвет ${value}`}
                aria-pressed={color === value && !eraser}
                onClick={() => {
                  setColor(value);
                  setEraser(false);
                }}
                className={`h-9 w-9 rounded-full border-2 ${color === value && !eraser ? "border-white ring-2 ring-amber-500/70" : "border-slate-600"}`}
                style={{ background: value }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Толщина
            <input
              aria-label="Толщина пера"
              type="range"
              min="2"
              max="24"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-20 accent-amber-500"
            />
            <span className="w-5">{width}</span>
          </label>
          <div className="flex gap-2 sm:ml-auto">
            <button
              aria-label="Отменить штрих"
              onClick={() => {
                const last = history[history.length - 1];
                const next = history.slice(0, -1);
                strokesRef.current = next;
                setHistory(next);
                setRedo([...redo, last]);
                setDirty(true);
                repaint();
              }}
              disabled={!history.length || busy}
              className={button}
            >
              ↶
            </button>
            <button
              aria-label="Повторить штрих"
              onClick={() => {
                const next = [...history, redo[redo.length - 1]];
                strokesRef.current = next;
                setHistory(next);
                setRedo(redo.slice(0, -1));
                setDirty(true);
                repaint();
              }}
              disabled={!redo.length || busy}
              className={button}
            >
              ↷
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              disabled={(!history.length && !imageRef.current) || busy}
              className={button}
            >
              Очистить
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto px-3 pb-3 sm:px-6">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            aria-label="Холст для рисования"
            className="block w-full touch-none rounded-xl bg-white shadow-inner"
            style={{
              aspectRatio: `${WIDTH}/${HEIGHT}`,
              cursor: eraser ? "cell" : "crosshair",
            }}
            onPointerDown={(event) => {
              if (
                busy ||
                loading ||
                pointerRef.current !== null ||
                (event.pointerType === "mouse" && event.button !== 0)
              )
                return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointerRef.current = event.pointerId;
              currentRef.current = {
                color,
                width: eraser ? width * 4 : width,
                eraser,
                points: [pointAt(event)],
              };
              repaint();
            }}
            onPointerMove={(event) => {
              if (!currentRef.current || pointerRef.current !== event.pointerId)
                return;
              currentRef.current.points.push(pointAt(event));
              repaint();
            }}
            onPointerUp={(event) => {
              if (pointerRef.current === event.pointerId) finishStroke();
            }}
            onPointerCancel={finishStroke}
            onLostPointerCapture={finishStroke}
          />
        </div>
        {(message || error || loading) && (
          <p
            role={error ? "alert" : "status"}
            className={`px-6 pb-3 text-sm ${error ? "text-red-400" : "text-amber-300"}`}
          >
            {error || message || "Открываю картинку…"}
          </p>
        )}
        {confirmClear && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-6 py-3 text-sm text-slate-300">
            <span>Очистить весь холст?</span>
            <button
              className={button}
              onClick={() => {
                imageRef.current = null;
                strokesRef.current = [];
                setHistory([]);
                setRedo([]);
                setDirty(true);
                setConfirmClear(false);
                repaint();
              }}
            >
              Очистить
            </button>
            <button className={button} onClick={() => setConfirmClear(false)}>
              Оставить
            </button>
          </div>
        )}
        {confirmClose && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-6 py-3 text-sm text-amber-300"
          >
            <span>Прикрепите или скачайте зарисовку перед закрытием.</span>
            <button className={button} onClick={() => setConfirmClose(false)}>
              Продолжить рисовать
            </button>
            <button className={button} onClick={onClose}>
              Закрыть без сохранения
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-4 py-3 sm:px-6">
          <span className="mr-auto text-xs text-slate-500">
            PNG · 1200 × 750
          </span>
          <button
            disabled={busy || loading}
            onClick={() => void action("copy")}
            className={button}
          >
            Копировать
          </button>
          <button
            disabled={busy || loading}
            onClick={() => void action("download")}
            className={button}
          >
            Скачать PNG
          </button>
          <button
            disabled={busy || loading}
            onClick={() => void action("attach")}
            className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {busy ? "Сохраняю…" : "Прикрепить"}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector("dialog[open]") ?? document.body,
  );
}
