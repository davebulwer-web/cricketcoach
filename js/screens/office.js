// The club office: home screen of a career. Shows the next match and how the
// county stands, and leads to the tables, fixtures and squad.
(function () {
  const P = CC.pal;
  const F = CC.font;

  function ordinal(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return n + 'TH';
    return n + ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH');
  }

  CC.engine.register('office', {
    enter() {
      const ui = CC.ui;
      const b = [];
      if (CC.Career.seasonOver()) {
        b.push(ui.button(90, 164, 140, 'SEASON REVIEW', 'Enter', () => CC.engine.go('review')));
      } else if (CC.Career.myFixture()) {
        b.push(ui.button(20, 164, 136, 'PLAY MATCH', 'Enter', () => CC.game.playFixture()));
        b.push(ui.button(164, 164, 136, 'SIMULATE MATCH', 'm', () => CC.game.simFixture()));
      } else {
        b.push(ui.button(90, 164, 140, 'CONTINUE', 'Enter', () => CC.game.simFixture()));
      }
      b.push(ui.button(20, 186, 64, 'TABLES', 't', () => CC.engine.go('tables', {})));
      b.push(ui.button(92, 186, 64, 'FIXTURES', 'f', () => CC.engine.go('fixtures', {})));
      b.push(ui.button(164, 186, 64, 'SQUAD', 's', () => CC.engine.go('squad', {})));
      b.push(ui.button(236, 186, 64, 'MARKET', 'k', () => CC.engine.go('market')));
      b.push(ui.button(170, 238, 130, 'SAVE AND EXIT', 'Escape', () => { CC.Career.save(); CC.game.mode = null; CC.engine.go('title'); }));
      this.buttons = b;
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      const c = CC.Career.myCounty();
      const sched = CC.Career.state.schedule;
      const ev = CC.Career.nextEvent();
      ctx.fillStyle = c.colour;
      ctx.fillRect(0, 0, 320, 4);
      F.drawText(ctx, c.fullName, 160, 10, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, 'SEASON ' + sched.year + (ev ? '  -  ' + ev.date : ''), 160, 30, { align: 'center', color: P.cream });

      // Next match.
      CC.ui.panel(ctx, 20, 44, 280, 52, P.grassDark);
      F.drawText(ctx, 'NEXT', 28, 50, { color: P.cream });
      if (!ev) {
        F.drawText(ctx, 'THE SEASON IS OVER', 160, 66, { align: 'center', color: P.yellow });
      } else {
        const comp = CC.Season.COMPS[ev.comp];
        F.drawText(ctx, comp.name, 160, 50, { align: 'center', color: P.yellow });
        F.drawText(ctx, ev.label, 160, 62, { align: 'center', color: P.white });
        const f = CC.Career.myFixture();
        if (f) {
          const home = f.home === c.id;
          const opp = CC.Career.county(home ? f.away : f.home);
          F.drawText(ctx, 'V ' + opp.fullName + (f.group === null ? '' : home ? ' (HOME)' : ' (AWAY)'), 160, 76, { align: 'center', color: P.white });
        } else {
          F.drawText(ctx, 'YOUR COUNTY IS NOT PLAYING', 160, 76, { align: 'center', color: P.greyLite });
        }
      }

      // Standings.
      CC.ui.panel(ctx, 20, 104, 280, 50, P.grassDark);
      const st = CC.Season.standing(sched, c.id);
      const pts = (comp, group) => CC.Season.table(sched, comp, group).find(r => r.id === c.id).pts;
      const row = (label, value, i) => {
        F.drawText(ctx, label, 28, 110 + i * 12, { color: P.cream });
        F.drawText(ctx, value, 292, 110 + i * 12, { color: P.white, align: 'right' });
      };
      row('CHAMPIONSHIP DIVISION ' + st.div, ordinal(st.cc) + '  ' + pts('CC', st.div) + ' PTS', 0);
      row('T20 ' + c.group + ' GROUP', ordinal(st.t20) + '  ' + pts('T20', c.group) + ' PTS', 1);
      row('50 CUP ' + c.group + ' GROUP', ordinal(st.od) + '  ' + pts('OD', c.group) + ' PTS', 2);

      // Squad notes.
      const w = CC.Career.transferWindow();
      F.drawText(ctx, 'TRANSFER WINDOW ' + w.text, 20, 208, { color: w.open ? P.yellow : P.greyLite });
      const warn = CC.Market.xiWarnings(CC.Career.state);
      const club = CC.Career.club();
      const xiText = warn.length ? 'XI: ' + warn[0] : 'XI: ' + (club.selection ? 'CHOSEN BY YOU' : 'PICKED AUTOMATICALLY');
      F.drawText(ctx, xiText, 20, 218, { color: warn.length ? P.orange : P.greyLite });
      const ending = club.players.filter(p => p.contract === 1).length;
      if (ending) F.drawText(ctx, ending + ' CONTRACTS END THIS SEASON', 20, 228, { color: P.greyLite });
    },
  });

  CC.ordinal = ordinal;
})();
