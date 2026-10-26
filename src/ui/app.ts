import { DAILY, LEVELS, RUSH } from '../core/config.ts';
import { DailyGame, formatTime, puzzleNumber, recordStreak, shareText, utcDateString } from '../core/daily.ts';
import { Grid } from '../core/grid.ts';
import { LevelGame } from '../core/levels.ts';
import { firstBlocker, freeArrows } from '../core/rules.ts';
import { RushGame } from '../core/rush.ts';
import { comboMultiplier } from '../core/scoring.ts';
import { errorHaptic, setHapticsEnabled, successHaptic, tapHaptic } from '../platform/haptics.ts';
import { initLifecycle } from '../platform/lifecycle.ts';
import { setSystemBarsDark } from '../platform/systembars.ts';
import { shareText as shareNative } from '../platform/share.ts';
import { Sound } from './audio.ts';
import { progress, type Settings } from './progress.ts';
import { Renderer } from './renderer.ts';
import { t } from './strings.ts';
import { palette } from './theme.ts';
import { TUTORIAL } from './tutorial.ts';

type Screen = 'menu' | 'settings' | 'playing' | 'pause' | 'gameover' | 'dailyResult' | 'levelResult';

type Session =
  | { kind: 'rush'; game: RushGame; prevBest: number }
  | { kind: 'daily'; game: DailyGame; practice: boolean }
  | { kind: 'level'; game: LevelGame }
  | { kind: 'tutorial'; step: number; grid: Grid };

export interface AppInfo {
  name: string;
  version: string;
  webUrl: string;
}

const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_HINT =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/></svg>';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export class FletchyApp {
  screen: Screen = 'menu';
  session: Session | null = null;
  private settings: Settings;
  private readonly sound = new Sound();
  private readonly renderer: Renderer;
  private readonly el: {
    hud: HTMLElement;
    stage: HTMLElement;
    canvas: HTMLCanvasElement;
    bar: HTMLElement;
    overlay: HTMLElement;
    hint: HTMLButtonElement;
  };
  private last = 0;
  private endAt: number | null = null;
  private advanceAt: number | null = null;
  private hudKey = '';
  /** Correct taps in a row (Daily/Levels), for the rising clear sound. */
  private streakTaps = 0;
  private flash = '';
  private readonly info: AppInfo;
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(root: HTMLElement, info: AppInfo) {
    this.info = info;
    root.innerHTML = `
      <header id="hud" hidden></header>
      <div id="stage"><canvas id="board" aria-label="Game board"></canvas></div>
      <footer id="bar" hidden>
        <button class="icon" data-action="pause" aria-label="${t('pause')}">${ICON_PAUSE}</button>
        <button class="icon hint" data-action="hint" aria-label="${t('hint')}">${ICON_HINT}<span></span></button>
      </footer>
      <div id="overlay"></div>`;
    const q = <T extends HTMLElement>(sel: string): T => {
      const e = root.querySelector<T>(sel);
      if (!e) throw new Error(`${sel} missing`);
      return e;
    };
    this.el = {
      hud: q('#hud'),
      stage: q('#stage'),
      canvas: q<HTMLCanvasElement>('#board'),
      bar: q('#bar'),
      overlay: q('#overlay'),
      hint: q<HTMLButtonElement>('.hint'),
    };
    this.settings = progress.settings();
    this.renderer = new Renderer(this.el.canvas, palette(false));
    this.applySettings();

    new ResizeObserver(() => this.resize()).observe(this.el.stage);
    this.resize();
    root.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (target) this.action(target.dataset.action ?? '');
    });
    this.el.canvas.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      const grid = this.grid();
      const id = grid ? this.renderer.arrowAt(grid, e.clientX, e.clientY) : null;
      if (id !== null) this.tap(id);
    });
    this.systemDark.addEventListener('change', () => this.applySettings());
    this.systemReducedMotion.addEventListener('change', () => this.applySettings());
    initLifecycle({ onPause: () => this.pause(), onBack: () => this.back() });

    if (progress.tutorialDone()) this.showMenu();
    else this.startTutorial();
    requestAnimationFrame((ts) => this.frame(ts));
  }

  // ---------- state helpers ----------

  grid(): Grid | null {
    const s = this.session;
    if (!s) return null;
    return s.kind === 'tutorial' ? s.grid : s.game.grid;
  }

  private today(): string {
    return utcDateString(new Date());
  }

  private resize(): void {
    const r = this.el.stage.getBoundingClientRect();
    this.renderer.resize(r.width, r.height);
  }

  private applySettings(): void {
    const s = this.settings;
    const dark = s.theme === 'dark' || (s.theme === 'system' && this.systemDark.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    this.renderer.palette = palette(dark);
    this.renderer.reducedMotion = s.reduceMotion || this.systemReducedMotion.matches;
    document.documentElement.classList.toggle('reduce-motion', this.renderer.reducedMotion);
    this.sound.enabled = s.sound;
    setHapticsEnabled(s.haptics);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.renderer.palette.bg);
    setSystemBarsDark(dark);
  }

  // ---------- sessions ----------

  private begin(session: Session): void {
    this.session = session;
    this.streakTaps = 0;
    this.endAt = null;
    this.advanceAt = null;
    this.renderer.reset();
    const g = this.grid();
    if (g) {
      this.renderer.setBoardSize(g.cols, g.rows);
      this.renderer.onSpawn([...g.arrows.values()], this.last);
    }
    this.hudKey = '';
    this.setScreen('playing');
  }

  startRush(seed = (Math.random() * 2 ** 32) >>> 0): void {
    this.begin({ kind: 'rush', game: new RushGame(seed), prevBest: progress.rushBest().score });
  }

  startDaily(practice?: boolean): void {
    const date = this.today();
    this.begin({ kind: 'daily', game: new DailyGame(date), practice: practice ?? progress.dailyResult(date) !== null });
  }

  startLevel(level = progress.levelReached()): void {
    this.begin({ kind: 'level', game: new LevelGame(level) });
  }

  startTutorial(step = 0): void {
    const lesson = TUTORIAL[step];
    if (!lesson) return;
    this.begin({ kind: 'tutorial', step, grid: Grid.from(lesson.board) });
    this.showTutorialHint();
  }

  private showTutorialHint(): void {
    const g = this.grid();
    const free = g ? freeArrows(g) : [];
    this.renderer.hintId = free[0]?.id ?? null;
  }

  // ---------- taps ----------

  tap(id: number): void {
    const s = this.session;
    const grid = this.grid();
    if (!s || !grid || this.screen !== 'playing' || this.endAt !== null) return;
    const arrow = grid.arrows.get(id);
    if (!arrow) return;
    const now = this.last;

    if (s.kind === 'rush') {
      const res = s.game.tap(id);
      if (res.kind === 'cleared') {
        const mult = comboMultiplier(res.combo);
        this.renderer.onClear(res.arrow, now, `+${res.points}${mult > 1 ? ` x${mult}` : ''}`);
        this.sound.clear(res.combo);
        tapHaptic();
      } else if (res.kind === 'blocked') {
        this.renderer.onBump(res.arrow, res.blockerId, now);
        this.sound.bump();
        errorHaptic();
      }
      return;
    }

    const blocker = firstBlocker(grid, arrow);
    if (s.kind === 'daily' || s.kind === 'level') {
      const res = s.game.tap(id);
      if (res === 'cleared') {
        this.renderer.onClear(arrow, now);
        this.sound.clear(1 + (++this.streakTaps % 12));
        tapHaptic();
      } else if (res === 'blocked' && blocker !== null) {
        this.streakTaps = 0;
        this.renderer.onBump(arrow, blocker, now);
        this.sound.bump();
        errorHaptic();
      }
      return;
    }

    // Tutorial: no penalty, just feedback.
    if (blocker !== null) {
      this.renderer.onBump(arrow, blocker, now);
      this.sound.bump();
      return;
    }
    grid.remove(id);
    this.renderer.onClear(arrow, now);
    this.sound.clear(4 - grid.size);
    tapHaptic();
    this.showTutorialHint();
    if (grid.size === 0) this.advanceAt = now + 0.6;
  }

  private useHint(): void {
    const grid = this.grid();
    const date = this.today();
    if (!grid || this.screen !== 'playing' || progress.hintsLeft(date) <= 0) return;
    const free = freeArrows(grid);
    if (free.length === 0) return;
    progress.useHint(date);
    this.renderer.hintId = (free.find((a) => a.cells.length > 1) ?? free[0])?.id ?? null;
    this.hudKey = '';
  }

  // ---------- loop ----------

  private frame(ts: number): void {
    const now = ts / 1000;
    const dt = Math.min(0.1, Math.max(0, now - this.last));
    this.last = now;
    if (this.screen === 'playing' && this.session) this.step(dt, now);
    this.renderer.draw(this.screen === 'menu' || this.screen === 'settings' ? null : this.grid(), now);
    this.updateHud();
    requestAnimationFrame((t2) => this.frame(t2));
  }

  private step(dt: number, now: number): void {
    const s = this.session;
    if (!s) return;
    if (s.kind === 'tutorial') {
      if (this.advanceAt !== null && now >= this.advanceAt) {
        this.advanceAt = null;
        if (s.step + 1 < TUTORIAL.length) this.startTutorial(s.step + 1);
        else this.finishTutorial();
      }
      return;
    }
    if (this.endAt !== null) {
      if (now >= this.endAt) {
        this.endAt = null;
        if (s.kind === 'rush') this.showGameOver();
        else if (s.kind === 'level') this.showLevelResult();
        else this.showDailyResult();
      }
      return;
    }
    if (s.kind === 'rush') {
      for (const e of s.game.tick(dt)) {
        if (e.type === 'spawn') {
          this.renderer.onSpawn(e.arrows, now);
          if (e.arrows.length > 0) this.sound.spawn();
        } else if (e.type === 'boardClear') {
          this.sound.boardClear();
          successHaptic();
        } else if (e.type === 'heartRestored') {
          this.sound.heart();
        } else if (e.type === 'gameOver') {
          this.sound.gameOver();
          errorHaptic();
          this.endAt = now + 0.8;
        }
      }
    } else {
      s.game.tick(dt);
      if (s.game.result) {
        if (s.game.result.solved) {
          this.sound.win();
          successHaptic();
        } else this.sound.gameOver();
        this.endAt = now + 0.7;
      }
    }
  }

  // ---------- HUD ----------

  private updateHud(): void {
    const s = this.session;
    if (this.screen !== 'playing' && this.screen !== 'pause') return;
    if (!s) return;
    let key: string;
    let html: string;
    const hearts = (n: number, max: number): string =>
      `<span class="hearts" role="img" aria-label="${t('heartsLabel', { n, max })}">${'<i class="full">♥</i>'.repeat(Math.max(0, n))}${'<i>♥</i>'.repeat(Math.max(0, max - n))}</span>`;
    if (s.kind === 'rush') {
      const g = s.game;
      const p = Math.round(g.pressure() * 100);
      const mult = comboMultiplier(g.combo);
      key = `r${g.score}|${g.hearts}|${g.combo}|${g.wave}|${p}`;
      html = `
        <div class="stat"><small>${t('score')}</small><b data-testid="score">${g.score}</b></div>
        <div class="pressure" style="--p:${p}" role="img" aria-label="${t('pressureLabel', { n: p })}"><span>${g.wave}</span></div>
        <div class="stat right">${hearts(g.hearts, RUSH.maxHearts)}<small class="combo${g.combo >= 5 ? ' hot' : ''}">${g.combo > 0 ? `${t('combo')} ${g.combo}${mult > 1 ? ` · x${mult}` : ''}` : '&nbsp;'}</small></div>`;
    } else if (s.kind === 'daily') {
      const g = s.game;
      key = `d${Math.floor(g.time)}|${g.hearts}`;
      html = `
        <div class="stat"><small>${t('dailyTitle', { n: g.puzzle })}</small><b>${formatTime(g.time)}</b></div>
        <div class="stat right">${hearts(g.hearts, DAILY.hearts)}<small>${t('par', { t: formatTime(g.par) })}</small></div>`;
    } else if (s.kind === 'level') {
      const g = s.game;
      key = `l${g.level}|${g.hearts}|${g.grid.size}`;
      html = `
        <div class="stat"><small>${g.spec.boss ? t('bossLevel') : t('levels')}</small><b>${t('levelTitle', { n: g.level })}</b></div>
        <div class="stat right">${hearts(g.hearts, LEVELS.hearts)}<small>${t('arrowsLeft', { n: g.grid.size })}</small></div>`;
    } else {
      const lesson = TUTORIAL[s.step];
      key = `t${s.step}`;
      html = `<p class="tutorial-text">${lesson ? t(lesson.text) : ''}</p><button class="skip" data-action="skipTutorial">${t('skip')}</button>`;
    }
    const hints = progress.hintsLeft(this.today());
    key += `|${hints}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.el.hud.innerHTML = html;
    const span = this.el.hint.querySelector('span');
    if (span) span.textContent = String(hints);
    this.el.hint.disabled = hints <= 0;
    this.el.hint.title = t('hintsLeft', { n: hints });
  }

  // ---------- screens ----------

  private setScreen(screen: Screen, overlayHtml = ''): void {
    this.screen = screen;
    const inGame = screen === 'playing' || screen === 'pause';
    this.el.hud.hidden = !inGame;
    this.el.bar.hidden = !inGame || this.session?.kind === 'tutorial';
    this.el.overlay.innerHTML = overlayHtml;
    this.el.overlay.className = overlayHtml ? 'open' : '';
    document.body.dataset.screen = screen;
    // One line per screen change; the Android emulator test follows these in logcat.
    console.info(`[fletchy] screen=${screen}`);
    this.hudKey = '';
    requestAnimationFrame(() => this.resize());
    (this.el.overlay.querySelector<HTMLElement>('[autofocus]') ?? null)?.focus();
  }

  showMenu(): void {
    this.session = null;
    const date = this.today();
    const best = progress.rushBest();
    const done = progress.dailyResult(date);
    const streak = progress.streak();
    const streakNow = streak.lastDate === date || streak.lastDate === utcDateString(new Date(Date.now() - 86_400_000)) ? streak.current : 0;
    this.setScreen(
      'menu',
      `<div class="screen menu">
        <img class="logo" src="${import.meta.env.BASE_URL}favicon.svg" alt="" width="88" height="88" />
        <h1>${esc(this.info.name)}</h1>
        <button class="big primary" data-action="rush" autofocus>
          <span>${t('rush')}</span><small>${best.score > 0 ? `${t('best')} ${best.score}` : t('rushTagline')}</small>
        </button>
        <button class="big" data-action="level">
          <span>${t('levels')} <em>${progress.levelReached()}</em></span>
          <small>${t('levelsTagline')}</small>
        </button>
        <button class="big" data-action="daily">
          <span>${t('daily')} <em>#${puzzleNumber(date)}</em></span>
          <small>${done ? `${t('dailyDone')} ${'★'.repeat(done.stars)}` : t('dailyTagline')}${streakNow > 0 ? ` · ${t('streak', { n: streakNow })}` : ''}</small>
        </button>
        <button data-action="settings">${t('settings')}</button>
        <p class="version">v${esc(this.info.version)}</p>
      </div>`,
    );
  }

  private showSettings(): void {
    const s = this.settings;
    const toggle = (key: 'sound' | 'haptics' | 'reduceMotion'): string =>
      `<button class="toggle" data-action="toggle:${key}" aria-pressed="${s[key]}">${t(key)}<span>${s[key] ? t('on') : t('off')}</span></button>`;
    const themeName = s.theme === 'system' ? t('themeSystem') : s.theme === 'dark' ? t('themeDark') : t('themeLight');
    this.setScreen(
      'settings',
      `<div class="screen settings">
        <h2>${t('settings')}</h2>
        ${toggle('sound')}
        ${toggle('haptics')}
        <button class="toggle" data-action="theme">${t('theme')}<span>${themeName}</span></button>
        ${toggle('reduceMotion')}
        <button data-action="tutorial">${t('replayTutorial')}</button>
        <a class="link" href="${import.meta.env.BASE_URL}privacy.html" target="_blank" rel="noopener">${t('privacy')}</a>
        <button class="primary" data-action="menu" autofocus>${t('back')}</button>
      </div>`,
    );
  }

  private pause(): void {
    if (this.screen !== 'playing' || !this.session || this.session.kind === 'tutorial' || this.endAt !== null) return;
    this.setScreen(
      'pause',
      `<div class="screen pause">
        <h2>${t('paused')}</h2>
        <button class="big primary" data-action="resume" autofocus>${t('resume')}</button>
        <button data-action="restart">${t('restart')}</button>
        <button data-action="menu">${t('menu')}</button>
      </div>`,
    );
  }

  private showGameOver(): void {
    const s = this.session;
    if (!s || s.kind !== 'rush') return;
    const g = s.game;
    progress.recordRush(g.score, g.wave);
    const best = progress.rushBest();
    let nudge = '';
    if (g.score > s.prevBest && s.prevBest > 0) nudge = `<p class="nudge good">${t('newBest')}</p>`;
    else if (s.prevBest > 0 && g.score >= s.prevBest * 0.75)
      nudge = `<p class="nudge">${t('soClose', { n: s.prevBest - g.score + 1 })}</p>`;
    this.setScreen(
      'gameover',
      `<div class="screen gameover" data-testid="gameover">
        <h2>${g.over === 'overflow' ? t('overflow') : t('outOfHearts')}</h2>
        <p class="big-score">${g.score}</p>
        ${nudge}
        <p class="meta">${t('best')} ${best.score} · ${t('wave')} ${g.wave} · ${t('bestCombo', { n: g.bestCombo })}</p>
        <button class="huge primary" data-action="rush" autofocus>${t('retry')}</button>
        <button data-action="menu">${t('menu')}</button>
      </div>`,
    );
  }

  private showDailyResult(): void {
    const s = this.session;
    if (!s || s.kind !== 'daily' || !s.game.result) return;
    const r = s.game.result;
    if (!s.practice && progress.recordDaily(r) && r.solved) progress.saveStreak(recordStreak(progress.streak(), r.date));
    const official = progress.dailyResult(r.date) ?? r;
    const streak = progress.streak();
    const stars = (n: number): string => `<span class="stars" role="img" aria-label="${n} of 3 stars">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
    this.setScreen(
      'dailyResult',
      `<div class="screen daily-result" data-testid="daily-result">
        <h2>${r.solved ? t('solved') : t('failed')}</h2>
        <p class="meta">${t('dailyTitle', { n: r.puzzle })}</p>
        ${stars(r.stars)}
        <p class="meta">${t('time')} ${r.solved ? formatTime(r.seconds) : '–'} · ${t('mistakes')} ${r.mistakes} · ${t('par', { t: formatTime(s.game.par) })}</p>
        ${streak.current > 0 ? `<p class="meta">${t('streak', { n: streak.current })}</p>` : ''}
        ${s.practice ? `<p class="nudge">${t('practice')}</p>` : ''}
        <button class="big primary" data-action="share" autofocus>${t('share')}</button>
        <p class="flash" aria-live="polite">${this.flash}</p>
        <button data-action="dailyPractice">${t('playAgain')}</button>
        <button data-action="menu">${t('menu')}</button>
      </div>`,
    );
    this.shareResult = shareText(official, this.info.name, this.info.webUrl);
  }

  private shareResult = '';

  private showLevelResult(): void {
    const s = this.session;
    if (!s || s.kind !== 'level' || !s.game.result) return;
    const r = s.game.result;
    if (r.solved) progress.recordLevel(r.level);
    this.setScreen(
      'levelResult',
      `<div class="screen level-result" data-testid="level-result">
        <h2>${r.solved ? t('levelCleared', { n: r.level }) : t('outOfHearts')}</h2>
        <p class="meta">${t('time')} ${formatTime(r.seconds)} · ${t('mistakes')} ${r.mistakes}</p>
        ${r.solved && (r.level + 1) % LEVELS.bossEvery === 0 ? `<p class="nudge">${t('bossNext')}</p>` : ''}
        <button class="huge primary" data-action="${r.solved ? 'nextLevel' : 'retryLevel'}" autofocus>${r.solved ? t('nextLevel') : t('retry')}</button>
        <button data-action="menu">${t('menu')}</button>
      </div>`,
    );
  }

  private finishTutorial(): void {
    progress.setTutorialDone();
    this.showMenu();
  }

  private back(): boolean {
    switch (this.screen) {
      case 'menu':
        return false;
      case 'playing':
        if (this.session?.kind === 'tutorial') this.finishTutorial();
        else this.pause();
        return true;
      case 'pause':
        this.setScreen('playing');
        return true;
      default:
        this.showMenu();
        return true;
    }
  }

  private action(name: string): void {
    this.sound.unlock();
    const s = this.session;
    switch (name) {
      case 'rush':
        this.startRush();
        break;
      case 'daily':
        this.startDaily();
        break;
      case 'level':
        this.startLevel();
        break;
      case 'nextLevel':
        if (s?.kind === 'level') this.startLevel(s.game.level + 1);
        break;
      case 'retryLevel':
        if (s?.kind === 'level') this.startLevel(s.game.level);
        break;
      case 'dailyPractice':
        this.startDaily(true);
        break;
      case 'settings':
        this.showSettings();
        break;
      case 'menu':
        this.showMenu();
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.setScreen('playing');
        break;
      case 'restart':
        if (s?.kind === 'rush') this.startRush();
        else if (s?.kind === 'daily') this.startDaily(true);
        else if (s?.kind === 'level') this.startLevel(s.game.level);
        break;
      case 'hint':
        this.useHint();
        break;
      case 'tutorial':
        this.startTutorial();
        break;
      case 'skipTutorial':
        this.finishTutorial();
        break;
      case 'share':
        void shareNative(this.shareResult).then((outcome) => {
          const msg = outcome === 'shared' ? t('shared') : outcome === 'copied' ? t('copied') : t('shareFailed');
          const el = this.el.overlay.querySelector('.flash');
          if (el) el.textContent = msg;
        });
        break;
      case 'theme': {
        const order: Settings['theme'][] = ['light', 'dark', 'system'];
        this.settings.theme = order[(order.indexOf(this.settings.theme) + 1) % order.length] ?? 'system';
        this.saveSettings();
        break;
      }
      default:
        if (name.startsWith('toggle:')) {
          const key = name.slice(7) as 'sound' | 'haptics' | 'reduceMotion';
          this.settings[key] = !this.settings[key];
          this.saveSettings();
        }
    }
  }

  private saveSettings(): void {
    progress.saveSettings(this.settings);
    this.applySettings();
    this.showSettings();
  }

  // ---------- test hook ----------

  debugApi(): FletchyDebug {
    const pick = (free: boolean): number | null => {
      const g = this.grid();
      if (!g) return null;
      const freeIds = new Set(freeArrows(g).map((a) => a.id));
      const a = [...g.arrows.values()].find((x) => freeIds.has(x.id) === free);
      return a?.id ?? null;
    };
    return {
      screen: () => this.screen,
      back: () => this.back(),
      advance: (seconds: number) => {
        const s = this.session;
        if (s?.kind !== 'rush') return;
        for (let t = 0; t < seconds && !s.game.over; t += 0.1) s.game.tick(0.1);
      },
      startRush: (seed?: number) => this.startRush(seed),
      startDaily: () => this.startDaily(),
      startLevel: (level?: number) => this.startLevel(level),
      skipTutorial: () => this.finishTutorial(),
      freeArrowCenter: () => {
        const id = pick(true);
        const a = id !== null ? this.grid()?.arrows.get(id) : undefined;
        const c = a?.cells[a.cells.length - 1];
        return c ? this.renderer.cellCenterClient(c) : null;
      },
      tapFree: () => {
        const id = pick(true);
        if (id !== null) this.tap(id);
        return id !== null;
      },
      tapBlocked: () => {
        const id = pick(false);
        if (id !== null) this.tap(id);
        return id !== null;
      },
      state: () => {
        const s = this.session;
        if (s?.kind === 'rush') return { kind: s.kind, score: s.game.score, hearts: s.game.hearts, arrows: s.game.grid.size, over: s.game.over };
        if (s?.kind === 'daily' || s?.kind === 'level')
          return { kind: s.kind, score: 0, hearts: s.game.hearts, arrows: s.game.grid.size, over: s.game.result ? (s.game.result.solved ? 'done' : 'hearts') : null };
        return { kind: s?.kind ?? 'none', score: 0, hearts: 0, arrows: this.grid()?.size ?? 0, over: null };
      },
    };
  }
}
