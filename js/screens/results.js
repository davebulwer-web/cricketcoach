// Results of a round of fixtures, shown after each match day.
(function () {
  const P = CC.pal;
  const F = CC.font;
  let ev = null;

  // "345 & 120-3D" style score for one side.
  function scores(r, id) {
    const inns = r.innings.filter(i => i.side === id);
    if (!inns.length) return 'DNB';
    return inns.map(i => i.runs + (i.wkts < 10 ? '-' + i.wkts : '') + (i.declared ? 'D' : '')).join(' & ');
  }

  CC.engine.register('results', {
    enter(params) {
      ev = params.event;
      this.buttons = [CC.ui.button(222, 238, 90, 'CONTINUE', 'Enter', () => CC.engine.go('office'))];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      if (!ev) return;
      const comp = CC.Season.COMPS[ev.comp];
      F.drawText(ctx, comp.name, 160, 4, { align: 'center', color: P.yellow, shadow: P.black });
      F.drawText(ctx, ev.label + '  -  ' + ev.date, 160, 14, { align: 'center', color: P.cream });
      const mine = CC.Career.state.countyId;
      const lineH = ev.fixtures.length > 5 ? 23 : 30;
      let y = 28;
      ev.fixtures.forEach(f => {
        const r = f.result;
        const colour = f.home === mine || f.away === mine ? P.yellow : P.white;
        const group = f.group === null ? '' : ev.comp === 'CC' ? 'D' + f.group + ' ' : f.group[0] + ' ';
        const line = key => group + CC.Career.county(f.home)[key] + ' ' + scores(r, f.home) + '  V  ' + CC.Career.county(f.away)[key] + ' ' + scores(r, f.away);
        let text = line('name');
        if (text.length > 52) text = line('short');   // long four-day scores: use three-letter codes
        F.drawText(ctx, text, 4, y, { color: colour });
        F.drawText(ctx, r.text, 316, y + 10, { align: 'right', color: P.cream });
        y += lineH;
      });
    },
  });

  CC.resultScores = scores;
})();
