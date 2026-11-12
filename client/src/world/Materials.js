import * as THREE from 'three';
import { canvasTexture, rng } from '../core/utils.js';

/** Paleta real. */
export const PALETTE = {
  gold: 0xf2c14e,
  goldDeep: 0xc9932b,
  purple: 0x5b1f7a,
  purpleDeep: 0x3a0f52,
  crimson: 0x9e1b32,
  marble: 0xf3efe6,
  stone: 0xc9bfae,
  stoneDark: 0x8d8371,
  ermine: 0xfbf8f2,
  skin: 0xf0c4a4,
  hair: 0x6b4429,
};

function noiseFill(ctx, w, h, base, variance, count, seed, size = 2) {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.floor((r() - 0.5) * variance);
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    ctx.fillRect(r() * w, r() * h, size, size);
  }
}

/** Desenha o brasão real: coroa dourada com monograma AH. */
export function drawCrest(ctx, cx, cy, s, { bg = null } = {}) {
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx + s, cy - s);
    ctx.lineTo(cx + s, cy + s * 0.3);
    ctx.quadraticCurveTo(cx + s, cy + s, cx, cy + s * 1.3);
    ctx.quadraticCurveTo(cx - s, cy + s, cx - s, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = s * 0.08;
    ctx.stroke();
  }
  // coroa
  ctx.fillStyle = '#f2c14e';
  ctx.strokeStyle = '#8a5a12';
  ctx.lineWidth = s * 0.03;
  const y0 = cy - s * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, y0);
  ctx.lineTo(cx - s * 0.7, y0 - s * 0.55);
  ctx.lineTo(cx - s * 0.35, y0 - s * 0.25);
  ctx.lineTo(cx, y0 - s * 0.7);
  ctx.lineTo(cx + s * 0.35, y0 - s * 0.25);
  ctx.lineTo(cx + s * 0.7, y0 - s * 0.55);
  ctx.lineTo(cx + s * 0.6, y0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx - s * 0.62, y0, s * 1.24, s * 0.14);
  ctx.fillStyle = '#d6203c';
  for (const dx of [-0.35, 0, 0.35]) {
    ctx.beginPath();
    ctx.arc(cx + dx * s, y0 + s * 0.07, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  // monograma
  ctx.fillStyle = '#f2c14e';
  ctx.font = `bold ${Math.round(s * 0.62)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AH', cx, cy + s * 0.42);
}

export function createMaterials(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (...a) => {
    const t = canvasTexture(...a);
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };

  const stoneTex = tex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#d4cab8', 60, 2500, 11);
    ctx.strokeStyle = 'rgba(80,70,55,0.45)';
    ctx.lineWidth = 2;
    const rows = 8;
    for (let y = 0; y < rows; y++) {
      const yy = (y * h) / rows;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
      const off = y % 2 ? w / 8 : 0;
      for (let x = 0; x < 4; x++) {
        const xx = off + (x * w) / 4;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy + h / rows);
        ctx.stroke();
      }
    }
  });

  const cobbleTex = tex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#a99f8e', 40, 1500, 12);
    const r = rng(5);
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = r() * h, s = 10 + r() * 10;
      const g = 140 + Math.floor(r() * 50);
      ctx.fillStyle = `rgb(${g + 10},${g},${g - 15})`;
      ctx.strokeStyle = 'rgba(60,50,40,0.5)';
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  });

  const plasterTex = tex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#f1e7d2', 30, 1800, 13);
    ctx.fillStyle = '#5a3b22';
    // enxaimel (madeira aparente)
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillRect(0, h * 0.5 - 6, w, 12);
    for (const x of [0, w / 2 - 6, w - 12]) ctx.fillRect(x, 0, 12, h);
    ctx.save();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#5a3b22';
    ctx.beginPath();
    ctx.moveTo(12, h * 0.5);
    ctx.lineTo(w / 2 - 6, 14);
    ctx.moveTo(w - 12, h * 0.5);
    ctx.lineTo(w / 2 + 6, 14);
    ctx.stroke();
    ctx.restore();
    // janelas
    for (const x of [w * 0.18, w * 0.62]) {
      ctx.fillStyle = '#3c2a1a';
      ctx.fillRect(x, h * 0.62, w * 0.2, h * 0.24);
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(x + 5, h * 0.62 + 5, w * 0.2 - 10, h * 0.24 - 10);
      ctx.fillStyle = '#3c2a1a';
      ctx.fillRect(x + w * 0.1 - 2, h * 0.62, 4, h * 0.24);
    }
  });

  const roofTex = tex(128, 128, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#ffffff', 50, 600, 14);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    for (let y = 0; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
    }
  }, { repeat: [3, 2] });

  const marbleTex = tex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#f4f0e8', 20, 800, 15);
    const r = rng(9);
    ctx.strokeStyle = 'rgba(150,140,130,0.25)';
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = 0.5 + r() * 2;
      ctx.beginPath();
      let x = r() * w, y = 0;
      ctx.moveTo(x, y);
      while (y < h) {
        x += (r() - 0.5) * 30;
        y += 10 + r() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  const carpetTex = tex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8f1428';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(3, 0, 5, h);
    ctx.fillRect(w - 8, 0, 5, h);
    for (let y = 16; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 + 10, y + 12);
      ctx.lineTo(w / 2, y + 24);
      ctx.lineTo(w / 2 - 10, y + 12);
      ctx.fill();
    }
  });

  const flagTex = tex(256, 384, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6a2590');
    g.addColorStop(1, '#3a0f52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    drawCrest(ctx, w / 2, h * 0.45, 80);
    // franja em ponta
    ctx.fillStyle = '#f2c14e';
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h - 14);
      ctx.lineTo(x + 16, h);
      ctx.lineTo(x + 32, h - 14);
      ctx.fill();
    }
  }, { repeat: [1, 1] });
  flagTex.wrapS = flagTex.wrapT = THREE.ClampToEdgeWrapping;

  const grassTex = tex(256, 256, (ctx, w, h) => noiseFill(ctx, w, h, '#ffffff', 70, 5000, 16, 2), { repeat: [80, 80] });

  const capeTex = tex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#5e0f2e');
    g.addColorStop(0.5, '#8a1840');
    g.addColorStop(1, '#5e0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // brocado
    ctx.fillStyle = 'rgba(242,193,78,0.18)';
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(0, 0, 14, h);
    ctx.fillRect(w - 14, 0, 14, h);
    ctx.fillRect(0, h - 18, w, 18);
  });
  capeTex.wrapS = capeTex.wrapT = THREE.ClampToEdgeWrapping;

  const ermineTex = tex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111';
    const r = rng(4);
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y + 8);
      ctx.lineTo(x - 3, y + 8);
      ctx.fill();
    }
  });

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = {
    stone: std({ map: stoneTex, roughness: 0.85, vertexColors: true }),
    stoneDark: std({ map: stoneTex, color: 0x9a9080, roughness: 0.9, vertexColors: true }),
    cobble: std({ map: cobbleTex, roughness: 0.95, vertexColors: true }),
    plaster: std({ map: plasterTex, roughness: 0.9, vertexColors: true }),
    roof: std({ map: roofTex, roughness: 0.75, vertexColors: true }),
    marble: std({ map: marbleTex, roughness: 0.35, metalness: 0.0, vertexColors: true }),
    gold: std({ color: PALETTE.gold, metalness: 1, roughness: 0.28, vertexColors: true }),
    goldGlow: std({ color: PALETTE.gold, metalness: 1, roughness: 0.25, emissive: 0xffa21a, emissiveIntensity: 9, vertexColors: true }),
    purple: std({ color: PALETTE.purple, roughness: 0.7, vertexColors: true }),
    crimson: std({ color: PALETTE.crimson, roughness: 0.65, vertexColors: true }),
    wood: std({ color: 0x6b4426, roughness: 0.9, vertexColors: true }),
    carpet: std({ map: carpetTex, roughness: 0.95 }),
    flag: std({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }),
    glass: std({ color: 0x8f5ad8, emissive: 0x9a55ff, emissiveIntensity: 4, roughness: 0.2, vertexColors: true }),
    foliage: std({ color: 0xffffff, roughness: 0.9, vertexColors: true, flatShading: true }),
    bark: std({ color: 0x5b3a22, roughness: 1, vertexColors: true }),
    water: new THREE.MeshStandardMaterial({ color: 0x3f7fa6, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.82 }),
    grass: std({ map: grassTex, vertexColors: true, roughness: 0.95 }),
    cape: std({ map: capeTex, side: THREE.DoubleSide, roughness: 0.6 }),
    ermine: std({ map: ermineTex, roughness: 0.95 }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb347).multiplyScalar(7) }),
  };
  m.water.userData.noShadow = true;
  m.glass.userData.noShadow = true;
  m.textures = { flagTex };
  return m;
}
