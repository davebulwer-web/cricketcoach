// Transfer market: free agents you can sign while a window is open.
(function () {
  const P = CC.pal;
  const F = CC.font;
  const PER_PAGE = 22;
  const FILTERS = ['ALL', 'OVERSEAS', 'HOME'];
  let filter = 0, page = 0, sel = 0, msg = '', confirm = null;

  function list() {
    const all = CC.Career.state.freeAgents.slice().sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl));
    return filter === 1 ? all.filter(p => p.overseas) : filter === 2 ? all.filter(p => !p.overseas) : all;
  }
  function shown() { return list().slice(page * PER_PAGE, (page + 1) * PER_PAGE); }
  function pages() { return Math.max(1, Math.ceil(list().length / PER_PAGE)); }
  function reset() { sel = 0; msg = ''; confirm = null; }

  CC.engine.register('market', {
    enter() {
      filter = 0; page = 0; reset();
      const ui = CC.ui;
      this.buttons = [
        ui.button(2, 241, 50, 'SIGN', 'Enter', () => {
          const p = shown()[sel];
          if (!p) return;
          const problem = CC.Market.signProblem(CC.Career.state, p);
          if (problem) { msg = problem; confirm = null; return; }
          if (confirm !== p.id) { confirm = p.id; msg = 'SIGN ' + p.name + ', ' + p.contract + 'Y AT ' + p.wage + 'K? PRESS SIGN AGAIN'; return; }
          confirm = null;
          const e = CC.Career.sign(p.id);
          msg = e || p.name + ' SIGNS FOR ' + CC.Career.myCounty().name;
          sel = Math.min(sel, Math.max(0, shown().length - 1));
        }),
        ui.button(54, 241, 66, 'FILTER', 'o', () => { filter = (filter + 1) % FILTERS.length; page = 0; reset(); }),
        ui.button(122, 241, 44, 'PREV', 'ArrowLeft', () => { page = Math.max(0, page - 1); reset(); }),
        ui.button(168, 241, 44, 'NEXT', 'ArrowRight', () => { page = Math.min(pages() - 1, page + 1); reset(); }),
        ui.button(214, 241, 50, 'SQUAD', 's', () => CC.engine.go('squad', {})),
        ui.button(266, 241, 52, 'BACK', 'Escape', () => CC.engine.go('office')),
      ];
    },

    onKey(key) {
      if (key === 'ArrowDown') { sel = Math.min(shown().length - 1, sel + 1); msg = ''; confirm = null; }
      if (key === 'ArrowUp') { sel = Math.max(0, sel - 1); msg = ''; confirm = null; }
    },

    onClick(x, y) {
      const T = CC.squadTable;
      const i = Math.floor((y - T.TOP + 1) / T.ROW);
      if (i >= 0 && i < shown().length) { sel = i; msg = ''; confirm = null; }
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      const T = CC.squadTable;
      const w = CC.Career.transferWindow();
      F.drawText(ctx, 'TRANSFER MARKET: ' + FILTERS[filter], 4, 2, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, 'PAGE ' + (page + 1) + '/' + pages(), 316, 2, { align: 'right', color: P.cream });
      T.drawHeader(ctx, 13, ['YRS', 'ASKS']);
      shown().forEach((p, i) => T.drawRow(ctx, p, T.TOP + i * T.ROW, { stripe: i % 2, selected: i === sel, market: true }));
      if (!shown().length) F.drawText(ctx, 'NO PLAYERS AVAILABLE', 160, 100, { align: 'center', color: P.greyLite });

      const club = CC.Career.club();
      const R = CC.Squads.RULES;
      F.drawText(ctx, 'WINDOW ' + w.text, 4, 210, { color: w.open ? P.yellow : P.orange });
      F.drawText(ctx, 'SQUAD ' + club.players.length + '/' + R.squadMax + '  OVERSEAS ' + CC.Career.overseasCount() + '/' +
        R.maxOverseasSquad + '  BUDGET LEFT ' + (club.budget - CC.Career.wageBill()) + 'K', 4, 220, { color: P.cream });
      const p = shown()[sel];
      const line = msg || (p ? (CC.Market.signProblem(CC.Career.state, p) || 'PRESS SIGN TO OFFER ' + p.name + ' A CONTRACT') : '');
      F.drawText(ctx, line, 4, 230, { color: P.white });
    },
  });
})();
