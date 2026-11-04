// League tables for all three competitions, plus the knockout rounds.
(function () {
  const P = CC.pal;
  const F = CC.font;
  const PAGES = [
    ['CC', 1], ['CC', 2], ['T20', 'NORTH'], ['T20', 'SOUTH'], ['OD', 'NORTH'], ['OD', 'SOUTH'], ['KO', null],
  ];
  let page = 0;

  CC.engine.register('tables', {
    enter(params) {
      if (params.page !== undefined) page = params.page;
      else page = CC.Career.division() - 1;
      const ui = CC.ui;
      this.buttons = [
        ui.button(8, 238, 70, 'PREV', 'ArrowLeft', () => { page = (page + PAGES.length - 1) % PAGES.length; }),
        ui.button(84, 238, 70, 'NEXT', 'ArrowRight', () => { page = (page + 1) % PAGES.length; }),
        ui.button(242, 238, 70, 'BACK', 'Escape', () => CC.engine.go('office')),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const [comp, group] = PAGES[page];
      if (comp === 'KO') return drawKnockouts(ctx);
      const sched = CC.Career.state.schedule;
      const rows = CC.Season.table(sched, comp, group);
      const mine = CC.Career.state.countyId;
      const title = CC.Season.COMPS[comp].name;
      const sub = comp === 'CC' ? 'DIVISION ' + group : group + ' GROUP';
      F.drawText(ctx, title, 160, 6, { align: 'center', color: P.yellow, shadow: P.black });
      F.drawText(ctx, sub + '  -  ' + sched.year, 160, 17, { align: 'center', color: P.cream });

      const cols = comp === 'CC'
        ? [['P', 150], ['W', 172], ['D', 194], ['L', 216], ['BAT', 244], ['BWL', 272], ['PTS', 308]]
        : [['P', 150], ['W', 172], ['L', 194], ['T', 216], ['NRR', 262], ['PTS', 308]];
      const y0 = 34;
      F.drawText(ctx, 'TEAM', 26, y0, { color: P.cream });
      cols.forEach(([h, x]) => F.drawText(ctx, h, x, y0, { align: 'right', color: P.cream }));
      ctx.fillStyle = P.cream;
      ctx.fillRect(4, y0 + 9, 312, 1);

      rows.forEach((r, i) => {
        const y = y0 + 14 + i * 16;
        // Zones: promotion (green), relegation (red), knockout places (blue).
        let zone = null;
        if (comp === 'CC' && group === 2 && i < CC.Season.PROMOTED) zone = P.grass;
        if (comp === 'CC' && group === 1 && i >= rows.length - CC.Season.PROMOTED) zone = P.darkRed;
        if (comp === 'CC' && group === 1 && i === 0) zone = P.orange;
        if (comp === 'T20' && i < 4) zone = P.blue;
        if (comp === 'OD' && i < 2) zone = P.blue;
        if (zone) { ctx.fillStyle = zone; ctx.fillRect(4, y - 3, 3, 13); }
        const colour = r.id === mine ? P.yellow : P.white;
        F.drawText(ctx, String(i + 1), 21, y, { align: 'right', color: colour });
        F.drawText(ctx, CC.Career.county(r.id).fullName, 26, y, { color: colour });
        const v = comp === 'CC' ? [r.p, r.w, r.d, r.l, r.bat, r.bowl, r.pts]
          : [r.p, r.w, r.l, r.t, (r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(2), r.pts];
        cols.forEach(([, x], k) => F.drawText(ctx, String(v[k]), x, y, { align: 'right', color: colour }));
      });

      const key = comp === 'CC'
        ? (group === 1 ? 'ORANGE = CHAMPIONS  RED = RELEGATED' : 'GREEN = PROMOTED')
        : (comp === 'T20' ? 'BLUE = QUARTER-FINALS' : 'BLUE = SEMI-FINALS');
      F.drawText(ctx, key, 160, 214, { align: 'center', color: P.greyLite });
      F.drawText(ctx, comp === 'CC' ? 'WIN 16, DRAW 8, PLUS BONUS POINTS' : 'WIN 2, TIE 1', 160, 224, { align: 'center', color: P.greyLite });
    },
  });

  function drawKnockouts(ctx) {
    const sched = CC.Career.state.schedule;
    F.drawText(ctx, 'KNOCKOUT ROUNDS', 160, 6, { align: 'center', color: P.yellow, shadow: P.black });
    const mine = CC.Career.state.countyId;
    let y = 22;
    ['T20', 'OD'].forEach(comp => {
      F.drawText(ctx, CC.Season.COMPS[comp].name, 4, y, { color: P.yellow });
      y += 11;
      sched.events.filter(e => e.comp === comp && e.stage !== 'group').forEach(ev => {
        F.drawText(ctx, ev.label + '  ' + ev.date, 10, y, { color: P.cream });
        y += 10;
        if (!ev.fixtures.length) { F.drawText(ctx, 'TO BE DECIDED', 16, y, { color: P.greyLite }); y += 10; return; }
        ev.fixtures.forEach(f => {
          const colour = f.home === mine || f.away === mine ? P.yellow : P.white;
          const n = id => CC.Career.county(id).name;
          F.drawText(ctx, n(f.home) + ' V ' + n(f.away), 16, y, { color: colour });
          F.drawText(ctx, f.result ? CC.Career.county(f.result.winner).name + ' WON' : '-', 316, y, { align: 'right', color: colour });
          y += 10;
        });
      });
      y += 6;
    });
  }
})();
