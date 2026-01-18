"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { IoIosSettings } from "react-icons/io";

type Mode = "focus" | "short" | "long";
type ThemePref = "light" | "dark";
type HistoryMap = Record<string, number>;

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
};

const STORAGE_KEYS = {
  settings: "pomodoroSettings",
  history: "pomodoroHistory",
  theme: "pomodoroTheme",
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("focus");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [remaining, setRemaining] = useState(
    DEFAULT_SETTINGS.focusMinutes * 60
  );
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<HistoryMap>({});
  const [themePref, setThemePref] = useState<ThemePref>("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const tickRef = useRef<number | null>(null);
  const modeSecondsRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const todayCount = history[todayKey] ?? 0;
  const totalFocusCount = useMemo(
    () => Object.values(history).reduce((sum, count) => sum + count, 0),
    [history]
  );

  const modeSeconds = useMemo(() => {
    if (mode === "focus") return settings.focusMinutes * 60;
    if (mode === "short") return settings.shortMinutes * 60;
    return settings.longMinutes * 60;
  }, [mode, settings.focusMinutes, settings.shortMinutes, settings.longMinutes]);

  useEffect(() => {
    const storedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const storedHistory = localStorage.getItem(STORAGE_KEYS.history);
    const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);

    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        setSettings({
          focusMinutes: parsed.focusMinutes ?? DEFAULT_SETTINGS.focusMinutes,
          shortMinutes: parsed.shortMinutes ?? DEFAULT_SETTINGS.shortMinutes,
          longMinutes: parsed.longMinutes ?? DEFAULT_SETTINGS.longMinutes,
        });
      } catch {}
    }

    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch {}
    }

    if (storedTheme === "light" || storedTheme === "dark") {
      setThemePref(storedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, themePref);
  }, [themePref]);

  useEffect(() => {
    if (isRunning) {
      tickRef.current = window.setInterval(() => {
        setRemaining((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    audioRef.current = new Audio(
      new URL("./f1.mp3", import.meta.url).toString()
    );
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    if (remaining === 0) {
      playSound();
      if (mode === "focus") {
        const nextFocusCount = totalFocusCount + 1;
        setHistory((prev) => {
          const next = { ...prev };
          next[todayKey] = (next[todayKey] ?? 0) + 1;
          return next;
        });
        const nextMode = nextFocusCount % 4 === 0 ? "long" : "short";
        setMode(nextMode);
        setRemaining(
          nextMode === "long"
            ? settings.longMinutes * 60
            : settings.shortMinutes * 60
        );
        return;
      }

      setMode("focus");
      setRemaining(settings.focusMinutes * 60);
    }
  }, [
    isRunning,
    remaining,
    mode,
    totalFocusCount,
    todayKey,
    settings.focusMinutes,
    settings.shortMinutes,
    settings.longMinutes,
  ]);

  useEffect(() => {
    if (modeSecondsRef.current === null) {
      modeSecondsRef.current = modeSeconds;
      return;
    }
    if (!isRunning && modeSecondsRef.current !== modeSeconds) {
      setRemaining(modeSeconds);
    }
    modeSecondsRef.current = modeSeconds;
  }, [modeSeconds, isRunning]);

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = formatDateKey(date);
      days.push({ key, count: history[key] ?? 0 });
    }
    return days;
  }, [history]);

  const yesterdayKey = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDateKey(date);
  }, []);

  const yesterdayCount = history[yesterdayKey] ?? 0;
  const weekTotal = last7Days.reduce((sum, day) => sum + day.count, 0);

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(modeSeconds);
  };

  const toggleTheme = () => {
    setThemePref((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const playSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  return (
    <div className={styles.page} data-theme={themePref} data-mode={mode}>
      <div className={styles.bgLayer} data-variant="focus" />
      <div className={styles.bgLayer} data-variant="short" />
      <div className={styles.bgLayer} data-variant="long" />
      <section className={styles.timerCard}>
        <div className={styles.modeRow}>
          <div className={styles.modeGroup}>
            <button
              className={`${styles.modeButton} ${
                mode === "focus" ? styles.modeActive : ""
              }`}
              onClick={() => handleModeChange("focus")}
            >
              집중
            </button>
            <button
              className={`${styles.modeButton} ${
                mode === "short" ? styles.modeActive : ""
              }`}
              onClick={() => handleModeChange("short")}
            >
              짧은 휴식
            </button>
            <button
              className={`${styles.modeButton} ${
                mode === "long" ? styles.modeActive : ""
              }`}
              onClick={() => handleModeChange("long")}
            >
              긴 휴식
            </button>
          </div>
          <IoIosSettings
            className={styles.settingButton}
            type="button"
            aria-label="기본시간 세팅"
            onClick={() => setShowSettings((prev) => !prev)}
          />
          <div className={styles.themeControls}>
            <button className={styles.secondaryButton} onClick={toggleTheme}>
              {themePref === "light" ? "Dark" : "White"}
            </button>
          </div>
        </div>

        <div className={styles.timerDisplay}>{formatTime(remaining)}</div>
        <div className={styles.currentTime}>
          {now.toLocaleTimeString("en-US", { hour12: false })}
        </div>
        <div className={styles.timerButtons}>
          <button
            className={styles.primaryButton}
            onClick={() => setIsRunning((prev) => !prev)}
          >
            {isRunning ? "일시정지" : "시작"}
          </button>
          <button className={styles.primaryButton} onClick={handleReset}>
            리셋
          </button>
                   
        </div>
        {showSettings && (
          <div className={styles.inlineSettings}>
            <div className={styles.settingsGrid}>
              <label className={styles.field}>
                집중 시간
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.focusMinutes}
                  className={styles.input}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      focusMinutes: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                짧은 휴식 시간
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.shortMinutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      shortMinutes: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                긴 휴식 시간
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.longMinutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      longMinutes: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <p className={styles.helperText}>
              타이머 종료 시에만 변경사항이 적용됩니다.
            </p>
          </div>
        )}
      </section>


    </div>
  );
}
