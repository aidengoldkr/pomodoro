"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { IoIosSettings } from "react-icons/io";
import { BiFullscreen } from "react-icons/bi";
import { CgDarkMode } from "react-icons/cg";

type Mode = "focus" | "short" | "long";
type ThemePref = "light" | "dark";
type HistoryMap = Record<string, number>;
type NotificationState = NotificationPermission | "unsupported";

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
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationState>("default");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tickRef = useRef<number | null>(null);
  const modeSecondsRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const current = Notification.permission;
    setNotificationPermission(current);
    if (current === "default") {
      Notification.requestPermission()
        .then((permission) => {
          setNotificationPermission(permission);
        })
        .catch(() => {
          setNotificationPermission(Notification.permission);
        });
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
        if (!endTimeRef.current) return;
        const secondsLeft = Math.max(
          0,
          Math.ceil((endTimeRef.current - Date.now()) / 1000)
        );
        setRemaining(secondsLeft);
      }, 500);
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
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLock) return;
    let isActive = true;

    const requestWakeLock = async () => {
      if (!isActive || !isRunning) return;
      if (document.visibilityState !== "visible") return;
      try {
        wakeLockRef.current = await wakeLock.request("screen");
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    if (isRunning) {
      void requestWakeLock();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (remaining === 0) {
      playSound();
      showNotification(
        "Pomodoro",
        mode === "focus" ? "Time for a break." : "Back to focus."
      );
      if (mode === "focus") {
        const nextFocusCount = totalFocusCount + 1;
        setHistory((prev) => {
          const next = { ...prev };
          next[todayKey] = (next[todayKey] ?? 0) + 1;
          return next;
        });
        const nextMode = nextFocusCount % 4 === 0 ? "long" : "short";
        setMode(nextMode);
        const nextSeconds =
          nextMode === "long"
            ? settings.longMinutes * 60
            : settings.shortMinutes * 60;
        setRemaining(nextSeconds);
        endTimeRef.current = Date.now() + nextSeconds * 1000;
        return;
      }

      setMode("focus");
      const nextSeconds = settings.focusMinutes * 60;
      setRemaining(nextSeconds);
      endTimeRef.current = Date.now() + nextSeconds * 1000;
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
    endTimeRef.current = null;
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(modeSeconds);
    endTimeRef.current = null;
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

  const unlockAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasMuted = audio.muted;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        audio.muted = wasMuted;
      });
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  };

  const showNotification = (title: string, body: string) => {
    if (notificationPermission !== "granted") return;
    try {
      new Notification(title, { body, tag: "pomodoro" });
    } catch {}
  };

  const handleToggleRun = () => {
    if (isRunning) {
      if (endTimeRef.current) {
        const secondsLeft = Math.max(
          0,
          Math.ceil((endTimeRef.current - Date.now()) / 1000)
        );
        setRemaining(secondsLeft);
      }
      endTimeRef.current = null;
      setIsRunning(false);
      return;
    }
    unlockAudio();
    if (notificationPermission === "default") {
      void requestNotificationPermission();
    }
    endTimeRef.current = Date.now() + remaining * 1000;
    setIsRunning(true);
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  return (
    <div className={styles.page} data-theme={themePref} data-mode={mode}>
      <div className={styles.topRightControls}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void handleToggleFullscreen()}
          aria-label={isFullscreen ? "전체화면 해제" : "전체화면"}
        >
          <BiFullscreen className={styles.fullscreenIcon} />
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={toggleTheme}
          aria-label={themePref === "light" ? "다크 모드" : "라이트 모드"}
        >
          <CgDarkMode className={styles.themeIcon} />
        </button>
      </div>
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
          <div className={styles.themeControls} />
        </div>

        <div className={styles.timerDisplay}>{formatTime(remaining)}</div>
        <div className={styles.currentTime}>
          {now.toLocaleTimeString("en-US", { hour12: false })}
        </div>
        <div className={styles.timerButtons}>
          <button
            className={styles.primaryButton}
            onClick={handleToggleRun}
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
