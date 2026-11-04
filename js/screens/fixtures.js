// Your county's fixtures and results for the season.
(function () {
  const P = CC.pal;
  const F = CC.font;
  const PER_PAGE = 20;
  let page = 0;

  // Short result from your county's point of view, e.g. "WON BY 7 WKTS".
  function outcome(r, mine) {
    if (!r) return '';
    if (r.by === 'draw') return 'DRAWN';
    if (r.winner === null) return 'TIED';
    const unit = r.by === 'innings' ? 'INNS & ' + r.margin : r.margin + (r.by === 'wickets' ? ' WKTS' : ' RUNS');
    return (r.winner === mine ? 'WON ' : 'LOST ') + unit;
  }

  function myFixtures() {
    const mine = CC.Career.state.countyId;
    const list = [];
    CC.Career.state.schedule.events.forEach(ev => {
      const f = CC.Season.myFixture(ev, mine);
      if (f) list.push({ ev, f });
      else if (ev.stage !== 'league' && ev.stage !== 'group' && !ev.done && !ev.fixtures.length) list.push({ ev, f: null });
    });
    return list;
  }

  CC.engine.register('fixtures', {
    enter() {
      const list = myFixtures();
      const next = list.findIndex(x => !x.f || !x.f.result);
      page = Math.max(0, Math.floor((next < 0 ? list.length - 1 : next) / PER_PAGE));
      const ui = CC.ui;
      this.buttons = [
        ui.button(8, 238, 70, 'PREV', 'ArrowLeft', () => { page = Math.max(0, page - 1); }),
        ui.button(84, 238, 70, 'NEXT', 'ArrowRight', () => { page = Math.min(Math.floor((myFixtures().length - 1) / PER_PAGE), page + 1); }),
        ui.button(242, 238, 70, 'BACK', 'Escape', () => CC.engine.go('office')),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const mine = CC.Career.state.countyId;
      const list = myFixtures();
      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      F.drawText(ctx, CC.Career.myCounty().fullName + ' FIXTURES ' + CC.Career.state.schedule.year, 4, 4, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, 'PAGE ' + (page + 1) + '/' + pages, 316, 4, { align: 'right', color: P.cream });
      const y0 = 18;
      F.drawText(ctx, 'DATE', 4, y0, { color: P.cream });
      F.drawText(ctx, 'COMP', 46, y0, { color: P.cream });
      F.drawText(ctx, 'OPPONENT', 94, y0, { color: P.cream });
      F.drawText(ctx, 'RESULT', 316, y0, { align: 'right', color: P.cream });
      ctx.fillStyle = P.cream;
      ctx.fillRect(4, y0 + 9, 312, 1);
      list.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach(({ ev, f }, i) => {
        const y = y0 + 13 + i * 10;
        const played = f && f.result;
        const colour = played ? P.white : P.greyLite;
        F.drawText(ctx, ev.date, 4, y, { color: colour });
        F.drawText(ctx, CC.Season.COMPS[ev.comp].short, 46, y, { color: colour });
        if (!f) { F.drawText(ctx, ev.label + ' IF QUALIFIED', 94, y, { color: colour }); return; }
        const home = f.home === mine;
        const opp = CC.Career.county(home ? f.away : f.home).name;
        const stage = f.group === null ? ev.stage + ' ' : '';
        F.drawText(ctx, stage + opp + (f.group === null ? '' : home ? ' (H)' : ' (A)'), 94, y, { color: colour });
        const o = outcome(f.result, mine);
        F.drawText(ctx, o, 316, y, { align: 'right', color: o.startsWith('WON') ? P.yellow : colour });
      });
    },
  });
})();
