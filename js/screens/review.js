// End of season: who won what, promotion and relegation, and how you did.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('review', {
    enter() {
      this.buttons = [
        CC.ui.button(8, 238, 70, 'BACK', 'Escape', () => CC.engine.go('office')),
        CC.ui.button(170, 238, 142, 'START ' + (CC.Career.state.season + 1) + ' SEASON', 'Enter', () => {
          CC.Career.startNextSeason();
          CC.engine.go('office');
        }),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      const sched = CC.Career.state.schedule;
      const s = CC.Season.summary(sched);
      const mine = CC.Career.state.countyId;
      const name = id => CC.Career.county(id).fullName;
      const col = id => id === mine ? P.yellow : P.white;
      F.drawText(ctx, 'SEASON ' + sched.year + ' REVIEW', 160, 8, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });

      let y = 34;
      const line = (label, ids) => {
        F.drawText(ctx, label, 20, y, { color: P.cream });
        ids.forEach((id, i) => F.drawText(ctx, name(id), 300, y + i * 10, { align: 'right', color: col(id) }));
        y += Math.max(1, ids.length) * 10 + 6;
      };
      line('COUNTY CHAMPIONS', [s.champions]);
      line('PROMOTED TO DIVISION 1', s.promoted);
      line('RELEGATED TO DIVISION 2', s.relegated);
      line(CC.Season.COMPS.T20.name, [s.t20]);
      line(CC.Season.COMPS.OD.name, [s.od]);

      const st = CC.Season.standing(sched, mine);
      const c = CC.Career.myCounty();
      CC.ui.panel(ctx, 20, y + 4, 280, 58, P.grassDark);
      F.drawText(ctx, 'YOUR SEASON: ' + c.fullName, 28, y + 10, { color: P.yellow });
      F.drawText(ctx, 'CHAMPIONSHIP DIVISION ' + st.div + ': ' + CC.ordinal(st.cc), 28, y + 22);
      F.drawText(ctx, 'T20 ' + c.group + ' GROUP: ' + CC.ordinal(st.t20) + (s.t20 === mine ? ' - WINNERS!' : ''), 28, y + 32);
      F.drawText(ctx, '50 CUP ' + c.group + ' GROUP: ' + CC.ordinal(st.od) + (s.od === mine ? ' - WINNERS!' : ''), 28, y + 42);
    },
  });
})();
