import { ActionState } from "./types";

export const SPRITE_SIZE = 530;  // Kaynak sprite frame boyutu (px)
export const DISPLAY_SIZE = 128; // Ekranda render edilen baz boyut (px)
export const SCALE = 1.2;        // Karakter ölçeği (DISPLAY_SIZE × SCALE = ekran boyutu)

// Her animasyonun kaç kareden oluştuğu bilgisi
export const ANIMATIONS: Record<ActionState, { src: string; frames: number; frameRate: number; loop: boolean }> = {
  idle:       { src: "/Blue_Slime/Idle.png",       frames: 13, frameRate: 7,  loop: true  },
  walk:       { src: "/Blue_Slime/walk.png",       frames: 8,  frameRate: 8,  loop: true  },
  run:        { src: "/Blue_Slime/Run.png",        frames: 10, frameRate: 18, loop: true  },
  start:      { src: "/Blue_Slime/Start.png",      frames: 5, frameRate: 30,  loop: false },
  stop:       { src: "/Blue_Slime/Stop.png",       frames: 5,  frameRate: 15, loop: false },
  jump:       { src: "/Blue_Slime/Jump.png",       frames: 5, frameRate: 15,  loop: false },
  attack1:    { src: "/Blue_Slime/Attack_1.png",   frames: 13, frameRate: 7,  loop: false },
  attack2:    { src: "/Blue_Slime/Attack_2.png",   frames: 13, frameRate: 7,  loop: false },
  attack3:    { src: "/Blue_Slime/Attack_3.png",   frames: 13, frameRate: 7,  loop: false },
  run_attack: { src: "/Blue_Slime/Run+Attack.png", frames: 13, frameRate: 7,  loop: false },
  hurt:       { src: "/Blue_Slime/Hurt.png",       frames: 13, frameRate: 7,  loop: false },
  dead:       { src: "/Blue_Slime/Dead.png",       frames: 13, frameRate: 7,  loop: false },
};

// Fizik ve Hareket Ayarları
export const PHYSICS = {
  useFrameBasedDistance: true,
  walkSpeed: 80,          
  runSpeed: 250,           
  walkDistancePerFrame: 10, 
  runDistancePerFrame: 18,  
  acceleration: 2500,      
  friction: 2000,          
  airFriction: 0,          
  gravity: 2400,           
  jumpForce: -850,         
  doubleJumpThreshold: 650, 
  mouseRunDistance: 150,   
  mouseWalkDistance: 40,   
  footOffsetY: 0,
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
