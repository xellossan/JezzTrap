// ============================================================================
// Quake VR & Desktop Arena - Procedural Quake 1 Palette Texture Generator
// Synthesizes Gothic Stone, Riveted Metal, Runic Floor, Lava, and Slipgate
// textures directly onto HTML5 Canvas for zero-dependency 3D rendering.
// ============================================================================

window.QuakeTextures = (function () {
  const cache = {};

  function createNoiseCanvas(width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    return canvas;
  }

  function makeThreeTexture(key, width, height, repeatX, repeatY, drawFn) {
    if (cache[key]) return cache[key];
    const canvas = createNoiseCanvas(width, height, drawFn);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    cache[key] = tex;
    return tex;
  }

  function getGothicBrick(repeatX = 4, repeatY = 2) {
    return makeThreeTexture(`brick_${repeatX}_${repeatY}`, 256, 256, repeatX, repeatY, (ctx, w, h) => {
      ctx.fillStyle = '#241c16';
      ctx.fillRect(0, 0, w, h);

      const rows = 8;
      const cols = 4;
      const rowH = h / rows;
      const colW = w / cols;

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const y = r * rowH;
          const shade = 40 + ((r * 17 + c * 31) % 24);
          ctx.fillStyle = `rgb(${shade + 14}, ${shade + 4}, ${shade - 4})`;
          ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

          // Highlight top/left bevel
          ctx.fillStyle = 'rgba(210, 170, 125, 0.14)';
          ctx.fillRect(x + 2, y + 2, colW - 4, 3);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(x + 2, y + rowH - 5, colW - 4, 3);
        }
      }

      // Grime & weathered noise speckles
      for (let i = 0; i < 2400; i++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(160,120,80,0.09)';
        ctx.fillRect(nx, ny, 2, 2);
      }
    });
  }

  function getRunicFloor(repeatX = 12, repeatY = 12) {
    return makeThreeTexture(`floor_${repeatX}_${repeatY}`, 256, 256, repeatX, repeatY, (ctx, w, h) => {
      ctx.fillStyle = '#1c1713';
      ctx.fillRect(0, 0, w, h);

      const tile = 64;
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          const v = 30 + ((x + y) % 14);
          ctx.fillStyle = `rgb(${v + 8}, ${v + 3}, ${v})`;
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
          ctx.strokeStyle = '#3f2e20';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, tile - 8, tile - 8);
        }
      }

      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(184,115,51,0.08)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  }

  function getRivetedMetal(repeatX = 2, repeatY = 2) {
    return makeThreeTexture(`metal_${repeatX}_${repeatY}`, 256, 256, repeatX, repeatY, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#463222');
      grad.addColorStop(0.5, '#2f2116');
      grad.addColorStop(1, '#1e140d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#704d30';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      // Cross seams
      ctx.strokeStyle = '#150d08';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Rivets
      const rivets = [
        [14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14],
        [w / 2 - 12, 14], [w / 2 + 12, 14], [w / 2 - 12, h - 14], [w / 2 + 12, h - 14]
      ];
      rivets.forEach(([rx, ry]) => {
        ctx.fillStyle = '#9a6b42';
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#140c07';
        ctx.beginPath();
        ctx.arc(rx + 1, ry + 1, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function getLavaTexture() {
    return makeThreeTexture('lava', 256, 256, 4, 4, (ctx, w, h) => {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 90; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 12 + Math.random() * 34;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, '#fef08a');
        g.addColorStop(0.4, '#f97316');
        g.addColorStop(0.8, '#b91c1c');
        g.addColorStop(1, 'rgba(127, 29, 29, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function getSlipgateTexture() {
    return makeThreeTexture('slipgate', 256, 256, 1, 1, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, '#f87171');
      g.addColorStop(0.6, '#dc2626');
      g.addColorStop(0.9, '#450a0a');
      g.addColorStop(1, '#090504');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Quake Runic Circle
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Quake Q horn motif
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.22, 0.25 * Math.PI, 0.75 * Math.PI, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.62);
      ctx.lineTo(w / 2, h * 0.85);
      ctx.stroke();
    });
  }

  function getAmmoCrateTexture(primaryColor, labelText) {
    const key = `crate_${primaryColor}_${labelText}`;
    return makeThreeTexture(key, 128, 128, 1, 1, (ctx, w, h) => {
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(14, 40, w - 28, 48);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, w / 2, h / 2);
    });
  }

  return {
    getGothicBrick,
    getRunicFloor,
    getRivetedMetal,
    getLavaTexture,
    getSlipgateTexture,
    getAmmoCrateTexture
  };
})();
