import { ActionState } from "./types";

export const SPRITE_SIZE = 530;  // Kaynak sprite frame boyutu (px)
export const DISPLAY_SIZE = 128; // Ekranda render edilen baz boyut (px)
export const SCALE = 1.6;        // Karakter ölçeği (DISPLAY_SIZE × SCALE = ekran boyutu)

// Karakter çarpışma boyutları
export const CHAR_HALF_WIDTH = 15; // Karakterin fiziksel genişliğinin yarısı
export const CHAR_HEIGHT = 50;     // Karakterin yaklaşık boyu

// Run animasyonu bölge sınırları (20 frame toplam)
export const RUN_START_END  = 5;   // Frame 0-5:   başlangıç (6 frame, sadece ilk girişte)
export const RUN_LOOP_START = 6;   // Frame 6-14:  ana döngü (9 frame)
export const RUN_LOOP_END   = 13;
export const RUN_STOP_START = 15;  // Frame 15-19: dur/dön  (5 frame)

// Jump animasyonu bölge sınırları (21 frame toplam)
export const JUMP_AIR_START  = 7;   // Frame 0-5:   startup/kalkış (6 frame)
export const JUMP_AIR_END    = 14;  // Frame 6-15:  havada (10 frame)
export const JUMP_LAND_START = 15;  // Frame 16-20: iniş (5 frame)

// Her animasyonun kaç kareden oluştuğu bilgisi
export const ANIMATIONS: Record<ActionState, { src: string; frames: number; frameRate: number; loop: boolean }> = {
  idle:       { src: "/Blue_Slime/Idle.png",       frames: 20, frameRate: 10,  loop: true  },
  walk:       { src: "/Blue_Slime/walk.png",       frames: 14, frameRate: 14,  loop: true  },
  run:        { src: "/Blue_Slime/Run.png",        frames: 20, frameRate: 16,  loop: true  },
  jump:       { src: "/Blue_Slime/Jump.png",       frames: 20, frameRate: 18,  loop: false },
  attack1:    { src: "/Blue_Slime/Attack_1.png",   frames: 13, frameRate: 7,   loop: false },
  attack2:    { src: "/Blue_Slime/Attack_2.png",   frames: 13, frameRate: 7,   loop: false },
  attack3:    { src: "/Blue_Slime/Attack_3.png",   frames: 13, frameRate: 7,   loop: false },
  run_attack: { src: "/Blue_Slime/Run+Attack.png", frames: 13, frameRate: 7,   loop: false },
  hurt:       { src: "/Blue_Slime/Hurt.png",       frames: 13, frameRate: 7,   loop: false },
  dead:       { src: "/Blue_Slime/Dead.png",       frames: 13, frameRate: 7,   loop: false },
};

// Fizik ve Hareket Ayarları
export const PHYSICS = {
  walkDistancePerFrame: 5,   // Frame-bazlı yürüme mesafesi
  runDistancePerFrame: 18,   // Frame-bazlı koşma mesafesi
  acceleration: 2500,
  friction: 2000,
  airFriction: 0,
  gravity: 2400,
  jumpForce: -850,
  doubleJumpThreshold: 650,
  mouseRunDistance: 150,
  mouseWalkDistance: 40,
  footOffsetY: 0,
  turnStopSpeedMult: 4,  // Dönüşlerde stop animasyonu 4x hızlı oynar
};

export const BOX_DEFAULT_HEIGHT = 200;
export const BOX_ACTIVE_HEIGHT = 175;

export const BOXES: any[] = [];
// BOXES devre dışı — aktif etmek için aşağıdaki satırları kopyala:
// export const BOXES: any[] = [
//   { id: "about",    label: "About me", width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: -270, href: "/about"    },
//   { id: "projects", label: "Projects", width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: 0,    href: "/projects" },
//   { id: "cv",       label: "e-cv",     width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: 270,  href: "/cv"       }
// ];
