// News inbox: results, notable performances, qualification, transfer windows.
(function () {
  const P = CC.pal;
  const F = CC.font;
  const LINES = 21;      // lines per page
  const WIDTH = 44;      // characters that fit after the date column
  let page = 0;

  function items() { return CC.Career.state.inbox || []; }

  // Every item as one or more screen lines, wrapping long ones at a space.
  function lines() {
    const out = [];
    items().forEach(n => {
      let text = n.text, first = true;
      while (text.length) {
        let cut = text.length <= WIDTH ? text.length : text.lastIndexOf(' ', WIDTH);
        if (cut <= 0) cut = WIDTH;
        out.push({ date: first ? n.date : '', text: text.slice(0, cut), read: n.read });
        text = text.slice(cut).trim();
        first = false;
      }
    });
    return out;
  }
  function pages() { return Math.max(1, Math.ceil(lines().length / LINES)); }

  CC.engine.register('news', {
    enter() {
      page = 0;
      const ui = CC.ui;
      this.buttons = [
        ui.button(8, 241, 70, 'PREV', 'ArrowLeft', () => { page = Math.max(0, page - 1); }),
        ui.button(84, 241, 70, 'NEXT', 'ArrowRight', () => { page = Math.min(pages() - 1, page + 1); }),
        ui.button(242, 241, 70, 'BACK', 'Escape', () => {
          items().forEach(n => { n.read = true; });
          CC.Career.save();
          CC.engine.go('office');
        }),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      F.drawText(ctx, 'NEWS', 4, 3, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, 'PAGE ' + (page + 1) + '/' + pages(), 316, 3, { align: 'right', color: P.cream });
      ctx.fillStyle = P.cream;
      ctx.fillRect(4, 13, 312, 1);
      const list = lines().slice(page * LINES, (page + 1) * LINES);
      if (!list.length) F.drawText(ctx, 'NO NEWS YET', 160, 100, { align: 'center', color: P.greyLite });
      list.forEach((n, i) => {
        const y = 18 + i * 10;
        F.drawText(ctx, n.date, 4, y, { color: n.read ? P.grey : P.yellow });
        F.drawText(ctx, n.text, 52, y, { color: n.read ? P.greyLite : P.white });
      });
    },
  });
})();
