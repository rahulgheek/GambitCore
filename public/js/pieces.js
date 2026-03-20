/* ============================================================
   PIECES.JS  –  SVG piece definitions
   White pieces: outlined (white fill, black stroke)
   Black pieces: solid (dark fill, black stroke + light details)

   SVG paths sourced from Wikimedia Chess pieces (public domain).
   viewBox is 45×45 for all pieces.
   ============================================================ */

'use strict';

/* Unicode fallback used in captured-pieces display */
const PIECE_UNICODE = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
};

/* ── White SVGs ── */
const W_PAWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
    fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const W_ROOK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/>
    <path d="M34 14l-3 3H14l-3-3"/>
    <path d="M31 17v12.5H14V17" stroke-linejoin="miter"/>
    <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
    <path d="M11 14h23" fill="none" stroke-linejoin="miter"/>
  </g>
</svg>`;

const W_BISHOP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#fff" stroke-linecap="butt">
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
    </g>
    <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/>
  </g>
</svg>`;

const W_QUEEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="12" r="2.75"/>
    <circle cx="14" cy="9" r="2.75"/>
    <circle cx="22.5" cy="8" r="2.75"/>
    <circle cx="31" cy="9" r="2.75"/>
    <circle cx="39" cy="12" r="2.75"/>
    <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25V11l-5.5 13.5-3-15-3 15L14 11v14L6.5 13.5 9 26z" stroke-linecap="butt"/>
    <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
    <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" fill="none"/>
  </g>
</svg>`;

const W_KING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 22.5,11.63 L 22.5,6" stroke-linejoin="miter" />
    <path d="M 20,8 L 25,8" stroke-linejoin="miter" />
    <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill="#fff" stroke-linecap="butt" stroke-linejoin="miter" />
    <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 L 33.5,30 C 33.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,30 11.5,30 L 11.5,37" fill="#fff" />
    <path d="M 11.5,30 C 17,27 28,27 33.5,30" />
    <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" />
    <path d="M 11.5,37 C 17,34 28,34 33.5,37" />
  </g>
</svg>`;

const W_KNIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g style="fill:none; fill-rule:evenodd; stroke:#000; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round;">
    <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#fff; stroke:#000;" />
    <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26.5 C 6,24 10,23 11,24 C 11,24 12.26,22.62 11.5,22 C 10.5,21 11,19 12.5,18 C 12.5,18 13.88,18.06 14.5,17 C 15.5,15 13.5,11 13.5,11 C 13.5,11 16.5,12 17.5,13 C 18.5,14 19.5,14 20.5,13 C 21.5,12 22.5,10 22.5,10 C 22.5,10 22,10 22,10 Z" style="fill:#fff; stroke:#000;" />
    <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:#000; stroke:#000;" />
    <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#000; stroke:#000;" />
  </g>
</svg>`;

/* ── Black SVGs (dark fill + light detail strokes) ── */
const B_PAWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
    fill="#1a1a1a" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const B_ROOK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="#1a1a1a" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/>
    <path d="M34 14l-3 3H14l-3-3"/>
    <path d="M31 17v12.5H14V17" stroke-linejoin="miter"/>
    <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
    <path d="M11 14h23" fill="none" stroke-linejoin="miter"/>
  </g>
</svg>`;

const B_BISHOP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#1a1a1a" stroke-linecap="butt">
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
    </g>
    <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#aaa" stroke-linejoin="miter"/>
  </g>
</svg>`;

const B_QUEEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="#1a1a1a" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="12" r="2.75"/>
    <circle cx="14" cy="9" r="2.75"/>
    <circle cx="22.5" cy="8" r="2.75"/>
    <circle cx="31" cy="9" r="2.75"/>
    <circle cx="39" cy="12" r="2.75"/>
    <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25V11l-5.5 13.5-3-15-3 15L14 11v14L6.5 13.5 9 26z" stroke-linecap="butt"/>
    <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
    <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" fill="none" stroke="#aaa"/>
  </g>
</svg>`;

const B_KING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 22.5,11.63 L 22.5,6" stroke-linejoin="miter" />
    <path d="M 20,8 L 25,8" stroke-linejoin="miter" />
    <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill="#1a1a1a" stroke-linecap="butt" stroke-linejoin="miter" />
    <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 L 33.5,30 C 33.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,30 11.5,30 L 11.5,37" fill="#1a1a1a" />
    <path d="M 11.5,30 C 17,27 28,27 33.5,30" stroke="#aaa" />
    <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" stroke="#aaa" />
    <path d="M 11.5,37 C 17,34 28,34 33.5,37" stroke="#aaa" />
  </g>
</svg>`;

const B_KNIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill="#1a1a1a" />
    <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26.5 C 6,24 10,23 11,24 C 11,24 12.26,22.62 11.5,22 C 10.5,21 11,19 12.5,18 C 12.5,18 13.88,18.06 14.5,17 C 15.5,15 13.5,11 13.5,11 C 13.5,11 16.5,12 17.5,13 C 18.5,14 19.5,14 20.5,13 C 21.5,12 22.5,10 22.5,10 C 22.5,10 22,10 22,10 Z" fill="#1a1a1a" />
    <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" fill="#fff" stroke="#fff" />
    <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" fill="#fff" stroke="#fff" />
    <path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z " fill="#fff" stroke="none" />
  </g>
</svg>`;

/* ── Export map ── */
const SVG_PIECES = {
  wP: W_PAWN,   wR: W_ROOK,   wB: W_BISHOP,
  wQ: W_QUEEN,  wK: W_KING,   wN: W_KNIGHT,
  bP: B_PAWN,   bR: B_ROOK,   bB: B_BISHOP,
  bQ: B_QUEEN,  bK: B_KING,   bN: B_KNIGHT,
};