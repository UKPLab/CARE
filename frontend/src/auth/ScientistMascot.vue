<template>
  <div
      class="mascot"
      :class="[`mascot--${mood}`, { 'is-happy': happy, 'is-stamped': stamped, 'is-lens-eye': lensEye }]"
      aria-hidden="true"
  >
    <svg
        class="mascot-svg"
        viewBox="0 0 160 150"
        width="132"
        height="124"
        xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- Soft shading in the style of animated emoji: light from the top left -->
        <radialGradient id="sm-skin" cx="36%" cy="30%" r="80%">
          <stop offset="0" stop-color="#ffeedd"/>
          <stop offset=".5" stop-color="#ffd3a9"/>
          <stop offset="1" stop-color="#f0a26e"/>
        </radialGradient>
        <radialGradient id="sm-ear" cx="40%" cy="35%" r="75%">
          <stop offset="0" stop-color="#ffd9b5"/>
          <stop offset="1" stop-color="#ec9a66"/>
        </radialGradient>
        <radialGradient id="sm-hair" cx="35%" cy="28%" r="80%">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset=".55" stop-color="#eef1f7"/>
          <stop offset="1" stop-color="#c3cadb"/>
        </radialGradient>
        <!-- Same gradient in viewBox units for the coat and the sleeves, so they blend at the shoulders -->
        <linearGradient id="sm-coat-body" gradientUnits="userSpaceOnUse" x1="0" y1="104" x2="0" y2="152">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#cfd8ea"/>
        </linearGradient>
        <linearGradient id="sm-primary" x1="0" y1="0" x2="0" y2="1">
          <stop class="stop-primary-light" offset="0"/>
          <stop class="stop-primary" offset="1"/>
        </linearGradient>
        <radialGradient id="sm-cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#ff7b86" stop-opacity=".55"/>
          <stop offset="1" stop-color="#ff7b86" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="sm-iris" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#6c84c4"/>
          <stop offset=".6" stop-color="#34447a"/>
          <stop offset="1" stop-color="#1b2140"/>
        </radialGradient>
        <linearGradient id="sm-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>
          <stop offset="1" stop-color="#bcd4ff" stop-opacity=".12"/>
        </linearGradient>
        <linearGradient id="sm-mouth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5a1f1a"/>
          <stop offset="1" stop-color="#8a3329"/>
        </linearGradient>
        <linearGradient id="sm-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#e9edf5"/>
        </linearGradient>
        <radialGradient id="sm-stamp" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#6fe3a4"/>
          <stop offset="1" stop-color="#1fa463"/>
        </radialGradient>
        <radialGradient id="sm-star" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#fff2b0"/>
          <stop offset="1" stop-color="#ffb627"/>
        </radialGradient>
        <radialGradient id="sm-glass" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".7"/>
          <stop offset="1" stop-color="#a9c8ff" stop-opacity=".35"/>
        </radialGradient>

        <!-- Updated every frame together with the mouth shape -->
        <clipPath id="sm-mouth-clip">
          <path ref="mouthClip"/>
        </clipPath>

        <!-- One hand, wrist at (0, 0), fingers pointing up -->
        <!-- Hair clumps, drawn twice: once as an outline, once filled -->
        <g id="sm-hair-side">
          <circle cx="47" cy="44" r="10"/>
          <circle cx="43" cy="58" r="13"/>
          <circle cx="40" cy="74" r="10"/>
          <circle cx="113" cy="44" r="10"/>
          <circle cx="117" cy="58" r="13"/>
          <circle cx="120" cy="74" r="10"/>
        </g>
        <g id="sm-hair-tuft">
          <circle cx="74" cy="35" r="7"/>
          <circle cx="84" cy="32" r="8"/>
          <circle cx="93" cy="36" r="5.5"/>
        </g>

        <g id="sm-hand">
          <rect x="-8.5" y="-1" width="17" height="7" rx="3.5" fill="url(#sm-primary)"/>
          <ellipse cx="0" cy="-15" rx="13" ry="15" fill="url(#sm-skin)"/>
          <ellipse cx="11" cy="-9" rx="4.5" ry="7" transform="rotate(28 11 -9)" fill="url(#sm-skin)"/>
          <path
              d="M-5.5 -28 v7 M0.5 -30 v8 M6.5 -28 v7"
              fill="none"
              stroke="#e39a6c"
              stroke-width="1.4"
              stroke-linecap="round"
              opacity=".55"
          />
          <ellipse cx="-4.5" cy="-22" rx="4" ry="3" fill="#fff" opacity=".35"/>
        </g>
      </defs>

      <g ref="figure">
        <!-- Lab coat: neck, rounded shoulders, straight sides -->
        <g class="mascot-body">
          <rect x="72" y="96" width="16" height="14" rx="6" fill="url(#sm-ear)"/>
          <path
              class="coat"
              d="M50 152 L51 130 C51 118 56 111 66 109 L73 106 Q80 111 87 106 L94 109 C104 111 109 118 109 130 L110 152 Z"
              fill="url(#sm-coat-body)"
          />
          <path d="M72 107 L80 128 L88 107 Q80 111.5 72 107 Z" fill="#dfe8ff"/>
          <path class="lapel" d="M70 108 L80 130 L74 138 L66 112 Z M90 108 L80 130 L86 138 L94 112 Z"/>
          <path d="M80 112 L76.5 116.5 L80 133 L83.5 116.5 Z" fill="url(#sm-primary)"/>
          <rect x="90.5" y="117" width="2.8" height="9" rx="1.4" fill="url(#sm-primary)"/>
          <rect class="pocket" x="87" y="123" width="10" height="9" rx="1.8"/>
          <ellipse cx="80" cy="106" rx="14" ry="3.5" fill="#8a5a3c" opacity=".14"/>
        </g>

        <g ref="head">
          <!-- Fluffy hair behind the head; the outline keeps it visible on light backgrounds -->
          <use href="#sm-hair-side" class="hair-outline"/>
          <use href="#sm-hair-side" fill="url(#sm-hair)"/>

          <circle cx="46" cy="72" r="7.5" fill="url(#sm-ear)"/>
          <circle cx="114" cy="72" r="7.5" fill="url(#sm-ear)"/>
          <ellipse cx="46.5" cy="72.5" rx="3.2" ry="4.2" fill="#e08a58" opacity=".45"/>
          <ellipse cx="113.5" cy="72.5" rx="3.2" ry="4.2" fill="#e08a58" opacity=".45"/>

          <ellipse cx="80" cy="67" rx="35" ry="33" fill="url(#sm-skin)"/>
          <!-- Shine on the bald top -->
          <ellipse cx="68" cy="45" rx="11" ry="6" transform="rotate(-18 68 45)" fill="#fff" opacity=".45"/>

          <!-- Small tuft on top -->
          <g class="tuft">
            <use href="#sm-hair-tuft" class="hair-outline"/>
            <use href="#sm-hair-tuft" fill="url(#sm-hair)"/>
          </g>

          <ellipse cx="58" cy="82" rx="8" ry="5.5" fill="url(#sm-cheek)"/>
          <ellipse cx="102" cy="82" rx="8" ry="5.5" fill="url(#sm-cheek)"/>

          <path ref="browL" class="brow" d="M58 50 Q66 45 74 49"/>
          <path ref="browR" class="brow" d="M86 49 Q94 45 102 50"/>

          <!-- Open eyes -->
          <g class="eyes">
            <g ref="eyeL">
              <ellipse cx="66" cy="66" rx="7" ry="8" fill="#fff"/>
              <g ref="irisL">
                <circle cx="66" cy="66.5" r="5" fill="url(#sm-iris)"/>
                <circle cx="66" cy="66.5" r="2.4" fill="#0f1328"/>
                <circle cx="67.8" cy="64.2" r="1.7" fill="#fff"/>
                <circle cx="64.4" cy="68.6" r=".8" fill="#fff" opacity=".8"/>
              </g>
            </g>
            <g ref="eyeR">
              <ellipse cx="94" cy="66" rx="7" ry="8" fill="#fff"/>
              <g ref="irisR">
                <circle cx="94" cy="66.5" r="5" fill="url(#sm-iris)"/>
                <circle cx="94" cy="66.5" r="2.4" fill="#0f1328"/>
                <circle cx="95.8" cy="64.2" r="1.7" fill="#fff"/>
                <circle cx="92.4" cy="68.6" r=".8" fill="#fff" opacity=".8"/>
              </g>
            </g>
          </g>

          <!-- Happy closed eyes ^ ^ -->
          <path class="eyes-happy" d="M60 68 Q66 61 72 68 M88 68 Q94 61 100 68"/>

          <g class="glasses">
            <circle cx="66" cy="66" r="12.5" fill="url(#sm-lens)"/>
            <circle cx="94" cy="66" r="12.5" fill="url(#sm-lens)"/>
            <path class="glasses-glint" d="M58 61 Q60 57 64.5 55.5 M86 61 Q88 57 92.5 55.5"/>
            <circle class="glasses-frame" cx="66" cy="66" r="12.5"/>
            <circle class="glasses-frame" cx="94" cy="66" r="12.5"/>
            <path class="glasses-frame" d="M78 65 Q80 62.5 82 65 M53.5 64 L47 62 M106.5 64 L113 62"/>
          </g>

          <ellipse cx="80" cy="75" rx="3.8" ry="2.8" fill="#f2a06c"/>
          <ellipse cx="79" cy="74" rx="1.4" ry=".9" fill="#fff" opacity=".6"/>

          <!-- Mouth: one path morphed between expressions -->
          <path ref="mouth" class="mouth"/>
          <g clip-path="url(#sm-mouth-clip)">
            <ellipse ref="tongue" fill="#ff7c88"/>
          </g>
        </g>

        <!-- Stack of documents, drawn around its center -->
        <g ref="docs">
          <rect x="-21" y="-22" width="42" height="44" rx="3" transform="rotate(7)" class="sheet sheet--back"/>
          <rect x="-21" y="-22" width="42" height="44" rx="3" transform="rotate(-5)" class="sheet sheet--middle"/>
          <g class="sheet-top">
            <rect x="-22" y="-22" width="44" height="44" rx="3.5" class="sheet" fill="url(#sm-paper)"/>
            <rect class="sheet-title" x="-16" y="-17" width="20" height="3" rx="1.5"/>
            <rect x="-16" y="-11" width="32" height="2.2" rx="1.1" fill="#cfd6e4"/>
            <rect x="-16" y="-6" width="28" height="2.2" rx="1.1" fill="#cfd6e4"/>
            <rect x="-16" y="-1" width="30" height="2.2" rx="1.1" fill="#cfd6e4"/>
            <path class="signature" d="M-16 12 q3 -5 6 0 t6 0 t6 -1"/>
            <g class="stamp">
              <circle cx="11" cy="8" r="8" fill="url(#sm-stamp)"/>
              <path
                  d="M7 8.2 L10 11.2 L15.2 5"
                  fill="none"
                  stroke="#fff"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
              />
            </g>
          </g>
        </g>

        <!-- Upright magnifier: handle in the hand, lens 55 above the wrist.
             When not in use it waits behind the card under the right hand. -->
        <g ref="magnifier">
          <path d="M0 -20 L0 -42" stroke="#8a6447" stroke-width="5" stroke-linecap="round"/>
          <path d="M0 -20 L0 -42" stroke="#b48a66" stroke-width="2" stroke-linecap="round"/>
          <circle cx="0" cy="-55" r="13" fill="url(#sm-glass)"/>
          <g class="magnifier-eye">
            <ellipse cx="0" cy="-55" rx="8.5" ry="9.5" fill="#fff"/>
            <circle cx="0" cy="-51.5" r="6" fill="url(#sm-iris)"/>
            <circle cx="0" cy="-51.5" r="3" fill="#0f1328"/>
            <circle cx="2.1" cy="-54.2" r="2" fill="#fff"/>
          </g>
          <circle cx="0" cy="-55" r="13" fill="none" stroke="#2e3a5c" stroke-width="3"/>
          <path d="M-8.5 -60 Q-5.5 -65.5 .5 -66" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>
        </g>

        <!-- Arms: one sleeve from the shoulder over the elbow to the wrist. The outline starts a
             little away from the shoulder, so the sleeve grows out of the coat without a seam. -->
        <path ref="armOutlineL" class="sleeve-outline"/>
        <path ref="armL" class="sleeve"/>
        <path ref="armOutlineR" class="sleeve-outline"/>
        <path ref="armR" class="sleeve"/>

        <g ref="handL">
          <use href="#sm-hand"/>
        </g>
        <g ref="handR">
          <use href="#sm-hand" transform="scale(-1 1)"/>
        </g>

        <!-- Sparkles when the terms are accepted -->
        <g class="sparkles" fill="url(#sm-star)">
          <g transform="translate(30 36)">
            <path class="sparkle" d="M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7 Z"/>
          </g>
          <g transform="translate(132 30)">
            <path class="sparkle" d="M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6 Z"/>
          </g>
          <g transform="translate(138 62)">
            <path class="sparkle" d="M0 -4.5 Q.8 -.8 4.5 0 Q.8 .8 0 4.5 Q-.8 .8 -4.5 0 Q-.8 -.8 0 -4.5 Z"/>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script>
/**
 * Scientist mascot shown above the registration card.
 *
 * Moods:
 * - wave: greets with the right hand (shown right after the page opens)
 * - idle: arms down, looks around and blinks
 * - cover: covers the eyes while a password is typed
 * - peek: brings a magnifier up from behind the card at the side of the body and peeks through it
 *   while the password is visible
 * - read: takes a stack of documents from behind the card and reads it (agreements step)
 * - approve: stamps the documents, is happy, then keeps holding them contentedly
 *
 * Body parts follow damped springs (see mascotRig.js) and are written to the SVG directly
 * every animation frame, outside of Vue's rendering. Props such as the magnifier and the
 * documents are always handed over behind the card, never popped in.
 * The mascot rises from behind the card on mount; hiding when leaving the page is done by
 * the view transition in AuthLayout.vue.
 */
import {
  DOCS_STORED,
  MAGNIFIER_GRIP,
  MAGNIFIER_STORED,
  MOUTHS,
  POSES,
  SHOULDER,
  bump,
  clamp,
  lerp,
  palmCenter,
  pointToward,
  rotate,
  setStiffness,
  snapSpring,
  spring,
  stepSpring,
  wrapAngle,
} from "@/auth/mascotRig";

const MASCOT_MOODS = ["wave", "idle", "cover", "peek", "read", "approve"];
const DOC_MOODS = ["read", "approve"];

/** Face per mood: mouth shape, brow offsets [left, right], head [tilt deg, down px], eye openness [left, right] */
const FACES = {
  wave: { mouth: "grin", brows: [-2, -2], head: [-3, 0], eyes: [1, 1] },
  idle: { mouth: "smile", brows: [0, 0], head: [0, 0], eyes: [1, 1] },
  cover: { mouth: "o", brows: [-3.5, -3.5], head: [0, 2], eyes: [0.12, 0.12] },
  peek: { mouth: "smirk", brows: [1.5, -4.5], head: [3, 1], eyes: [0.12, 0.12] },
  read: { mouth: "focus", brows: [1, 0], head: [-1.5, 2.5], eyes: [1, 1] },
  approve: { mouth: "grin", brows: [-3, -3], head: [0, 0], eyes: [1, 1] },
};

/** Hand poses per mood */
const HAND_POSES = {
  wave: { L: "restL", R: "waveR" },
  idle: { L: "restL", R: "restR" },
  cover: { L: "coverL", R: "coverR" },
  peek: { L: "coverL", R: "peekR" },
  read: { L: "readL", R: "readR" },
  approve: { L: "readL", R: "readR" },
};

/** How long the happy ^ ^ face lasts after accepting before the mascot calms down */
const CELEBRATE_S = 1.7;

const HAND_STIFFNESS = 260;
/** Slightly slower, careful move while lifting the magnifier */
const HAND_STIFFNESS_SNEAKY = 180;
/** The elbow follows the wrist a little softer, which gives the arm a natural follow-through */
const ELBOW_FACTOR = 0.75;

/** Pause (ms) while a hand reaches behind the card for a prop */
const REACH_MS = 300;
const GRAB_MS = 90;

/** The sleeve outline starts this far from the shoulder, so the sleeve blends into the coat */
const SLEEVE_SEAM_FREE = 7;

function createHand(pose) {
  return {
    x: spring(pose.w[0], HAND_STIFFNESS, 0.72),
    y: spring(pose.w[1], HAND_STIFFNESS, 0.72),
    ex: spring(pose.e[0], HAND_STIFFNESS * ELBOW_FACTOR, 0.8),
    ey: spring(pose.e[1], HAND_STIFFNESS * ELBOW_FACTOR, 0.8),
    turn: spring(pose.a, 220, 0.72),
    pose,
    angle: pose.a,
    wrist: { x: pose.w[0], y: pose.w[1] },
  };
}

function createRig() {
  const mouth = MOUTHS.smile;
  const rig = {
    hands: { L: createHand(POSES.restL), R: createHand(POSES.restR) },
    headTilt: spring(0, 110, 0.55),
    headDown: spring(0, 160, 0.65),
    browL: spring(0, 170, 0.55),
    browR: spring(0, 170, 0.55),
    eyeL: spring(1, 900, 0.9),
    eyeR: spring(1, 900, 0.9),
    lookX: spring(0, 220, 0.8),
    lookY: spring(0, 220, 0.8),
    mouth: Object.fromEntries(Object.entries(mouth).map(([key, value]) => [key, spring(value, 170, 0.62)])),
    // The magnifier catches up with the rising hand from behind the card
    magnifierAttach: spring(0, 160, 1),
    docsAttach: spring(0, 320, 1),
    magnifierHeld: false,
    docsHeld: false,
    mood: "idle",
    moodStart: 0,
    approveStart: 0,
    nextBlink: 1.5,
    blinkUntil: 0,
    nextGlance: 1,
    look: { x: 0, y: 0 },
    lastTime: null,
    time: 0,
  };
  rig.springs = [
    rig.hands.L.x, rig.hands.L.y, rig.hands.L.turn, rig.hands.L.ex, rig.hands.L.ey,
    rig.hands.R.x, rig.hands.R.y, rig.hands.R.turn, rig.hands.R.ex, rig.hands.R.ey,
    rig.headTilt, rig.headDown, rig.browL, rig.browR, rig.eyeL, rig.eyeR, rig.lookX, rig.lookY,
    ...Object.values(rig.mouth),
    rig.magnifierAttach, rig.docsAttach,
  ];
  return rig;
}

const fmt = (n) => Math.round(n * 100) / 100;

export default {
  name: "ScientistMascot",
  props: {
    mood: {
      type: String,
      required: false,
      default: "idle",
      validator: (value) => MASCOT_MOODS.includes(value),
    },
  },
  data() {
    return {
      happy: false,
      stamped: false,
      lensEye: false,
    };
  },
  watch: {
    mood(value) {
      this.plan(value);
    },
  },
  mounted() {
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.rig = createRig();
    this.planToken = 0;
    this.destroyed = false;
    this.render();
    this.frame = requestAnimationFrame(this.tick);
    this.plan(this.mood);
  },
  beforeUnmount() {
    this.destroyed = true;
    this.planToken++;
    cancelAnimationFrame(this.frame);
  },
  methods: {
    now() {
      return performance.now() / 1000;
    },
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, this.reducedMotion ? 0 : ms));
    },
    setHandPose(side, poseName) {
      this.rig.hands[side].pose = POSES[poseName];
    },
    setHandSpeed(side, stiffness) {
      const hand = this.rig.hands[side];
      setStiffness(hand.x, stiffness, 0.72);
      setStiffness(hand.y, stiffness, 0.72);
      setStiffness(hand.ex, stiffness * ELBOW_FACTOR, 0.8);
      setStiffness(hand.ey, stiffness * ELBOW_FACTOR, 0.8);
    },
    /**
     * Move to a mood. Props are put away or picked up first, so the hands never
     * jump and the magnifier and documents never appear out of thin air.
     */
    async plan(mood) {
      const token = ++this.planToken;
      const rig = this.rig;
      const cancelled = () => this.destroyed || token !== this.planToken;

      // Lower the magnifier back behind the card at the side of the body
      if (rig.magnifierHeld && mood !== "peek") {
        this.lensEye = false;
        this.setHandSpeed("R", HAND_STIFFNESS);
        this.setHandPose("R", "lowR");
        rig.magnifierHeld = false;
        await this.wait(REACH_MS);
        if (cancelled()) return;
      }

      // Put the documents back behind the card
      if (rig.docsHeld && !DOC_MOODS.includes(mood)) {
        this.stamped = false;
        this.happy = false;
        this.setHandPose("L", "docsPickupL");
        this.setHandPose("R", "docsPickupR");
        await this.wait(REACH_MS);
        if (cancelled()) return;
        rig.docsHeld = false;
        await this.wait(GRAB_MS);
        if (cancelled()) return;
      }

      // Take the documents from behind the card
      if (DOC_MOODS.includes(mood) && !rig.docsHeld) {
        this.setHandPose("L", "docsPickupL");
        this.setHandPose("R", "docsPickupR");
        await this.wait(REACH_MS);
        if (cancelled()) return;
        rig.docsHeld = true;
        await this.wait(GRAB_MS);
        if (cancelled()) return;
      }

      // Keep one eye covered, drop the right hand behind the card and take the magnifier there.
      // applyMood then raises the hand along the side of the body, the magnifier comes up with it.
      if (mood === "peek" && !rig.magnifierHeld) {
        this.applyFace("peek");
        this.setHandPose("L", "coverL");
        this.setHandPose("R", "lowR");
        await this.wait(REACH_MS);
        if (cancelled()) return;
        rig.magnifierHeld = true;
      }

      this.applyMood(mood);
    },
    applyFace(mood) {
      this.rig.faceMood = mood;
    },
    applyMood(mood) {
      const rig = this.rig;
      const previous = rig.mood;
      rig.mood = mood;
      rig.moodStart = this.now();
      this.applyFace(mood);
      this.setHandPose("L", HAND_POSES[mood].L);
      this.setHandPose("R", HAND_POSES[mood].R);
      // Lifting the magnifier is a little more careful than other moves
      this.setHandSpeed("R", mood === "peek" ? HAND_STIFFNESS_SNEAKY : HAND_STIFFNESS);

      if (mood === "peek") {
        const token = this.planToken;
        this.wait(450).then(() => {
          if (!this.destroyed && token === this.planToken) {
            this.lensEye = true;
          }
        });
      }

      if (mood === "approve" && previous !== "approve") {
        rig.approveStart = this.now();
        this.happy = true;
        this.stamped = true;
        const token = this.planToken;
        this.wait(CELEBRATE_S * 1000).then(() => {
          if (!this.destroyed && token === this.planToken) {
            this.happy = false;
          }
        });
      }
      if (mood !== "approve") {
        this.happy = false;
        this.stamped = false;
      }
    },
    tick(timestamp) {
      if (this.destroyed) return;
      const rig = this.rig;
      const time = timestamp / 1000;
      const dt = rig.lastTime === null ? 0 : Math.min(time - rig.lastTime, 1 / 30);
      rig.lastTime = time;
      rig.time = time;

      this.updateTargets(time);

      if (this.reducedMotion) {
        rig.springs.forEach(snapSpring);
      } else if (dt > 0) {
        const steps = Math.ceil(dt / (1 / 240));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          rig.springs.forEach((s) => stepSpring(s, h));
        }
      }

      this.render();
      this.frame = requestAnimationFrame(this.tick);
    },
    /** Pose and face targets plus the small motions that keep the character alive */
    updateTargets(t) {
      const rig = this.rig;
      const mood = rig.mood;
      const face = FACES[rig.faceMood || mood];
      const since = t - rig.moodStart;
      const calm = this.reducedMotion ? 0 : 1;

      const offsets = {
        L: { x: 0, y: 0, a: 0 },
        R: { x: 0, y: 0, a: 0 },
      };
      let tilt = face.head[0];
      const down = face.head[1];

      // Nobody holds perfectly still
      offsets.L.x += 0.9 * Math.sin(t * 1.3);
      offsets.L.y += 0.7 * Math.sin(t * 1.7 + 1);
      offsets.R.x += 0.9 * Math.sin(t * 1.1 + 2);
      offsets.R.y += 0.7 * Math.sin(t * 1.5 + 0.4);
      tilt += 1.2 * Math.sin(t * 0.9) + 0.5 * Math.sin(t * 2.3 + 1);

      if (mood === "wave") {
        const envelope = clamp((since - 0.45) / 0.4, 0, 1);
        const phase = t * 2 * Math.PI * 1.3;
        offsets.R.x += 3 * Math.sin(phase) * envelope;
        offsets.R.a += 22 * Math.sin(phase) * envelope;
        tilt += -2 * Math.sin(phase - 0.8) * envelope;
      }

      if (mood === "cover") {
        offsets.L.a += 2 * Math.sin(t * 2.2);
        offsets.R.a += 2 * Math.sin(t * 2.2 + 1.3);
      }

      if (mood === "peek") {
        // The lens is far from the wrist, so keep the hand sway small
        offsets.R.y += 1 * Math.sin(t * 1.2);
        offsets.R.a += 0.8 * Math.sin(t * 0.9);
        tilt += 1 * Math.sin(t * 0.8);
      }

      if (mood === "approve") {
        const p = t - rig.approveStart;
        // Joyful hop of the documents right after the stamp
        const hop = 7 * bump(p / 0.6);
        offsets.L.y -= hop;
        offsets.R.y -= hop;
        if (p > CELEBRATE_S) {
          // Hums along and taps the stack straight now and then
          tilt += 3 * Math.sin(t * 3.4);
          const q = (p - CELEBRATE_S) % 3.6;
          const tap = 3 * bump(q / 0.4);
          offsets.L.y -= tap;
          offsets.R.y -= tap;
        }
      }

      for (const side of ["L", "R"]) {
        const hand = rig.hands[side];
        const { w, e, a } = hand.pose;
        const offset = offsets[side];
        hand.x.target = w[0] + offset.x * calm;
        hand.y.target = w[1] + offset.y * calm;
        // The elbow takes part of the small motions, so the whole arm moves, not only the hand
        hand.ex.target = e[0] + offset.x * 0.5 * calm;
        hand.ey.target = e[1] + offset.y * 0.5 * calm;
        // Turn the short way round to the wanted hand angle
        const angle = a + offset.a * calm;
        hand.turn.target = hand.turn.x + wrapAngle(angle - hand.turn.x);
      }

      rig.headTilt.target = tilt * calm + face.head[0] * (1 - calm);
      rig.headDown.target = down;
      rig.browL.target = face.brows[0];
      rig.browR.target = face.brows[1];

      // Mouth
      let mouthName = face.mouth;
      if (mood === "approve" && !this.happy) {
        mouthName = "content";
      }
      const mouth = MOUTHS[mouthName];
      Object.entries(mouth).forEach(([key, value]) => {
        rig.mouth[key].target = value;
      });

      // Eyes: blinking and where to look
      if (t > rig.nextBlink) {
        rig.blinkUntil = t + 0.12;
        rig.nextBlink = t + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3);
      }
      const blink = t < rig.blinkUntil ? 0.05 : 1;
      rig.eyeL.target = face.eyes[0] * blink;
      rig.eyeR.target = face.eyes[1] * blink;

      if (mood === "read") {
        // Follow the lines of the page: slowly to the right, quickly back
        const p = (t % 2.2) / 2.2;
        rig.lookX.target = p < 0.8 ? lerp(-1.6, 1.6, p / 0.8) : lerp(1.6, -1.6, (p - 0.8) / 0.2);
        rig.lookY.target = 2.2;
      } else if (mood === "wave") {
        rig.lookX.target = 0;
        rig.lookY.target = 0;
      } else {
        if (t > rig.nextGlance) {
          const towardDocs = mood === "approve" && Math.random() < 0.4;
          rig.look = towardDocs
            ? { x: 0, y: 2.2 }
            : { x: (Math.random() * 2 - 1) * 1.5, y: (Math.random() * 2 - 1) * 0.9 };
          rig.nextGlance = t + 1.2 + Math.random() * 2.5;
        }
        rig.lookX.target = rig.look.x;
        rig.lookY.target = rig.look.y;
      }

      rig.magnifierAttach.target = rig.magnifierHeld ? 1 : 0;
      rig.docsAttach.target = rig.docsHeld ? 1 : 0;
    },
    /** Write the current spring values to the SVG */
    render() {
      const rig = this.rig;
      const refs = this.$refs;
      const t = rig.time;

      const breath = this.reducedMotion ? 0 : 1.2 * Math.sin(t * 1.6);
      refs.figure.setAttribute("transform", `translate(0 ${fmt(breath)})`);

      // Arms and hands
      for (const side of ["L", "R"]) {
        const hand = rig.hands[side];
        const shoulder = SHOULDER[side];
        const wrist = { x: hand.x.x, y: hand.y.x };
        const elbow = { x: hand.ex.x, y: hand.ey.x };
        hand.angle = hand.turn.x;
        hand.wrist = wrist;

        const tail = `L${fmt(elbow.x)} ${fmt(elbow.y)} L${fmt(wrist.x)} ${fmt(wrist.y)}`;
        refs[`arm${side}`].setAttribute("d", `M${shoulder.x} ${shoulder.y} ${tail}`);
        // No outline right at the shoulder: there the sleeve flows into the coat
        const seamStart = pointToward(shoulder, elbow, SLEEVE_SEAM_FREE);
        refs[`armOutline${side}`].setAttribute("d", `M${fmt(seamStart.x)} ${fmt(seamStart.y)} ${tail}`);
        refs[`hand${side}`].setAttribute(
          "transform",
          `translate(${fmt(wrist.x)} ${fmt(wrist.y)}) rotate(${fmt(hand.angle)})`
        );
      }

      // Magnifier: blend between its spot behind the card and the right hand, around the gripped point
      const right = rig.hands.R;
      const attach = clamp(rig.magnifierAttach.x, 0, 1);
      const storedGrip = rotate(MAGNIFIER_GRIP, MAGNIFIER_STORED.angle);
      const heldGrip = rotate(MAGNIFIER_GRIP, right.angle);
      const grip = {
        x: lerp(MAGNIFIER_STORED.x + storedGrip.x, right.wrist.x + heldGrip.x, attach),
        y: lerp(MAGNIFIER_STORED.y + storedGrip.y, right.wrist.y + heldGrip.y, attach),
      };
      const magnifierAngle = MAGNIFIER_STORED.angle + wrapAngle(right.angle - MAGNIFIER_STORED.angle) * attach;
      const gripOffset = rotate(MAGNIFIER_GRIP, magnifierAngle);
      refs.magnifier.setAttribute(
        "transform",
        `translate(${fmt(grip.x - gripOffset.x)} ${fmt(grip.y - gripOffset.y)}) rotate(${fmt(magnifierAngle)})`
      );

      // Documents: blend between behind the card and the palms of both hands
      const palmL = palmCenter(rig.hands.L.wrist, rig.hands.L.angle);
      const palmR = palmCenter(right.wrist, right.angle);
      const docsAttach = clamp(rig.docsAttach.x, 0, 1);
      const heldAngle = Math.atan2(palmR.y - palmL.y, palmR.x - palmL.x) * 180 / Math.PI;
      const docsX = lerp(DOCS_STORED.x, (palmL.x + palmR.x) / 2, docsAttach);
      const docsY = lerp(DOCS_STORED.y, (palmL.y + palmR.y) / 2, docsAttach);
      const docsAngle = lerp(DOCS_STORED.angle, clamp(heldAngle, -12, 12), docsAttach);
      refs.docs.setAttribute("transform", `translate(${fmt(docsX)} ${fmt(docsY)}) rotate(${fmt(docsAngle)})`);

      // Head and face
      refs.head.setAttribute(
        "transform",
        `rotate(${fmt(rig.headTilt.x)} 80 104) translate(0 ${fmt(rig.headDown.x)})`
      );
      refs.browL.setAttribute("transform", `translate(0 ${fmt(rig.browL.x)})`);
      refs.browR.setAttribute("transform", `translate(0 ${fmt(rig.browR.x)})`);

      const openL = clamp(rig.eyeL.x, 0.04, 1.1);
      const openR = clamp(rig.eyeR.x, 0.04, 1.1);
      refs.eyeL.setAttribute("transform", `translate(66 66) scale(1 ${fmt(openL)}) translate(-66 -66)`);
      refs.eyeR.setAttribute("transform", `translate(94 66) scale(1 ${fmt(openR)}) translate(-94 -66)`);
      const look = `translate(${fmt(rig.lookX.x)} ${fmt(rig.lookY.x)})`;
      refs.irisL.setAttribute("transform", look);
      refs.irisR.setAttribute("transform", look);

      const m = rig.mouth;
      const w = Math.max(m.w.x, 2) / 2;
      const yl = m.yl.x;
      const yr = m.yr.x;
      const mid = (yl + yr) / 2;
      const upper = mid + m.c.x;
      const lower = upper + Math.max(m.open.x, 0);
      const mouthPath = `M${fmt(80 - w)} ${fmt(yl)} Q80 ${fmt(upper)} ${fmt(80 + w)} ${fmt(yr)} Q80 ${fmt(lower)} ${fmt(80 - w)} ${fmt(yl)} Z`;
      refs.mouth.setAttribute("d", mouthPath);
      refs.mouthClip.setAttribute("d", mouthPath);
      refs.tongue.setAttribute("cx", "80");
      // The lower lip of a quadratic curve peaks halfway to its control point
      refs.tongue.setAttribute("cy", fmt((mid + lower) / 2 - 1.5));
      refs.tongue.setAttribute("rx", fmt(w * 0.6));
      refs.tongue.setAttribute("ry", "4");
    },
  },
};
</script>

<style scoped>
.mascot {
  transform-origin: 50% 100%;
  animation: mascot-rise 1s cubic-bezier(.45, 0, .2, 1) .2s both;
}

.mascot-svg {
  display: block;
  overflow: visible;
}

.stop-primary {
  stop-color: var(--bs-primary);
}

.stop-primary-light {
  stop-color: color-mix(in srgb, var(--bs-primary) 60%, #fff);
}

/* The white coat gets a soft blue-grey edge so it stands out on light backgrounds */
.coat {
  stroke: #aab5cc;
  stroke-width: 1.6;
}

.lapel {
  fill: #c9d2e4;
}

.pocket {
  fill: #e3e9f4;
  stroke: #aab5cc;
  stroke-width: 1.2;
}

.sleeve,
.sleeve-outline {
  fill: none;
  stroke-linejoin: round;
}

/* Same gradient as the coat, so the sleeve is one piece with the shoulder */
.sleeve {
  stroke: url(#sm-coat-body);
  stroke-width: 12;
  stroke-linecap: round;
}

/* Flat start: no ring where the outline begins near the shoulder; the wrist end is under the cuff */
.sleeve-outline {
  stroke: #aab5cc;
  stroke-width: 14.5;
  stroke-linecap: butt;
}

/* Drawn under the filled hair: only the outer edge stays visible */
.hair-outline {
  fill: #a9b2c6;
  stroke: #a9b2c6;
  stroke-width: 3;
}

.brow {
  fill: none;
  stroke: #b3bacb;
  stroke-width: 3.4;
  stroke-linecap: round;
}

.eyes {
  transition: opacity .18s ease;
}

.eyes-happy {
  fill: none;
  stroke: #2b3350;
  stroke-width: 2.8;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity .18s ease;
}

.is-happy .eyes {
  opacity: 0;
}

.is-happy .eyes-happy {
  opacity: 1;
}

.glasses-frame {
  fill: none;
  stroke: #2e3a5c;
  stroke-width: 2.6;
  stroke-linecap: round;
}

.glasses-glint {
  fill: none;
  stroke: #fff;
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: .9;
}

.mouth {
  fill: url(#sm-mouth);
  stroke: #6e2a22;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tuft {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: mascot-tuft 4s ease-in-out infinite;
}

/* ---------- Documents ---------- */
.sheet {
  stroke: #c2cadb;
  stroke-width: .8;
}

.sheet--back {
  fill: #dfe4ee;
}

.sheet--middle {
  fill: #eceff6;
}

.sheet-title {
  fill: color-mix(in srgb, var(--bs-primary) 55%, #fff);
}

.signature {
  fill: none;
  stroke: #b7c0d3;
  stroke-width: 1.4;
  stroke-linecap: round;
  transition: stroke .3s ease;
}

.is-stamped .signature {
  stroke: color-mix(in srgb, var(--bs-primary) 80%, #000);
}

.sheet-top {
  transform-box: fill-box;
  transform-origin: 0% 100%;
}

.mascot--read .sheet-top {
  animation: mascot-page-lift 3.4s ease-in-out 1.6s infinite;
}

.stamp {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(1.8) rotate(-40deg);
  transition: opacity .15s ease, transform .3s ease;
}

/* The stamp lands from above: big and transparent, then pressed onto the paper */
.is-stamped .stamp {
  opacity: 1;
  transform: scale(1) rotate(-12deg);
  transition: opacity .12s ease .1s, transform .45s cubic-bezier(.3, 1.6, .5, 1) .1s;
}

/* ---------- Magnifier ---------- */
.magnifier-eye {
  opacity: 0;
  transition: opacity .3s ease;
}

.is-lens-eye .magnifier-eye {
  opacity: 1;
}

/* ---------- Sparkles ---------- */
.sparkle {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
}

.mascot--approve .sparkle {
  animation: mascot-sparkle 2.6s ease-in-out .2s infinite;
}

.mascot--approve .sparkles g:nth-child(2) .sparkle {
  animation-delay: .7s;
}

.mascot--approve .sparkles g:nth-child(3) .sparkle {
  animation-delay: 1.3s;
}

/* ---------- Keyframes ---------- */
@keyframes mascot-rise {
  0% {
    transform: translateY(120px) scale(.94, 1.04);
  }
  65% {
    transform: translateY(-5px) scale(1.02, .98);
  }
  85% {
    transform: translateY(1px) scale(.995, 1.005);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes mascot-tuft {
  0%, 100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(4deg);
  }
}

@keyframes mascot-page-lift {
  0%, 70%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  82% {
    transform: translate(-1px, -3px) rotate(-4deg);
  }
}

@keyframes mascot-sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1.15) rotate(20deg);
  }
  60% {
    opacity: 1;
    transform: scale(.9) rotate(45deg);
  }
  80% {
    opacity: 0;
    transform: scale(.4) rotate(60deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mascot,
  .mascot * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
