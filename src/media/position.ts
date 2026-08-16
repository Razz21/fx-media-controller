import { logger } from '../utils/logger';

interface MediaPosition {
  duration: number;
  position: number;
  playbackRate: number;
  timestamp: number;
}

export class PositionTracker {
  public pos: MediaPosition | null = null;
  private rafId: number | null = null;
  private isPlaying: boolean = false;
  private paused: boolean = true;
  private onUpdate: (pos: { duration: number; position: number }) => void;
  private onTick: (pos: { duration: number; position: number }) => void;
  private win: Window;

  constructor(
    win: Window,
    onUpdate: (pos: { duration: number; position: number }) => void,
    onTick: (pos: { duration: number; position: number }) => void,
  ) {
    this.win = win;
    this.onUpdate = onUpdate;
    this.onTick = onTick;
  }

  pause(): void {
    if (this.paused) return;
    logger.debug('[PositionTracker] pause');
    this.paused = true;
    this.stopRAF();
  }

  resume(): void {
    logger.debug(`[PositionTracker] resume: { paused:${this.paused} }`);
    if (!this.paused) return;
    this.paused = false;

    if (this.pos) {
      if (this.isPlaying) {
        const now = this.win.performance.now();
        const elapsed = (now - this.pos.timestamp) / 1000;
        this.pos.position = Math.min(
          Math.max(this.pos.position + elapsed * this.pos.playbackRate, 0),
          this.pos.duration,
        );
        this.pos.timestamp = now;
        this.startRAF();
      }
      this.pushUpdate();
    } else {
      logger.debug('[PositionTracker] resume: no position yet');
    }
  }

  sync(eventOrPos: {
    duration?: number;
    position?: number;
    playbackRate?: number;
  }): void {
    const duration = eventOrPos.duration;
    const position = eventOrPos.position;
    const playbackRate = eventOrPos.playbackRate ?? 1.0;

    if (duration === undefined || position === undefined || duration <= 0) {
      logger.debug('[PositionTracker] sync: invalid data', eventOrPos);
      return;
    }

    logger.debug('[PositionTracker] sync:', {
      duration,
      position,
      playbackRate,
    });
    this.pos = {
      duration,
      position: Math.min(position, duration),
      playbackRate,
      timestamp: this.win.performance.now(),
    };

    if (!this.paused) {
      this.pushUpdate();
    }

    if (this.isPlaying && !this.paused) {
      this.startRAF();
    } else {
      this.stopRAF();
    }
  }

  setPlaying(playing: boolean): void {
    if (this.isPlaying === playing) return;
    logger.debug('[PositionTracker] setPlaying:', playing);
    this.isPlaying = playing;
    if (playing && this.pos && !this.paused) {
      this.pos.timestamp = this.win.performance.now();
      this.startRAF();
    } else {
      this.stopRAF();
      if (!this.paused) {
        this.pushUpdate();
      }
    }
  }

  private startRAF(): void {
    if (this.rafId !== null || this.paused) return;
    logger.debug('[PositionTracker] startRAF');
    this.rafId = this.win.requestAnimationFrame(this.tick);
  }

  private stopRAF(): void {
    if (this.rafId !== null) {
      logger.debug('[PositionTracker] stopRAF');
      this.win.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (timestamp: number): void => {
    logger.debug('[PositionTracker] tick');
    if (this.paused || !this.pos || !this.isPlaying) {
      this.stopRAF();
      if (!this.paused) this.pushUpdate();
      return;
    }

    const elapsed = (timestamp - this.pos.timestamp) / 1000;
    let currentPos = this.pos.position + elapsed * this.pos.playbackRate;
    if (currentPos >= this.pos.duration) currentPos = this.pos.duration;
    currentPos = Math.min(Math.max(currentPos, 0), this.pos.duration);

    if (!this.paused) {
      this.onTick({ duration: this.pos.duration, position: currentPos });
    }

    if (this.isPlaying && !this.paused) {
      this.rafId = this.win.requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };

  private pushUpdate(): void {
    if (this.pos && !this.paused) {
      logger.debug('[PositionTracker] pushUpdate:', this.pos);
      this.onUpdate({
        duration: this.pos.duration,
        position: this.pos.position,
      });
    } else {
      logger.debug('[PositionTracker] pushUpdate: skipped', {
        hasPos: !!this.pos,
        paused: this.paused,
      });
    }
  }

  destroy(): void {
    logger.debug('[PositionTracker] destroy');
    this.stopRAF();
    this.pos = null;
    this.isPlaying = false;
    this.paused = true;
  }
}
