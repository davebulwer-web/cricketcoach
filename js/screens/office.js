// The club office: home screen of a career.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('office', {
    enter() {
      this.buttons = [
        CC.ui.button(20, 150, 130, 'SQUAD', 's', () => CC.engine.go('squad', {})),
        CC.ui.button(170, 150, 130, 'FRIENDLY MATCH', 'Enter', () => CC.engine.go('format', { mode: 'career' })),
        CC.ui.button(170, 238, 130, 'SAVE AND EXIT', 'Escape', () => { CC.Career.save(); CC.engine.go('title'); }),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      const c = CC.Career.myCounty();
      const club = CC.Career.club();
      ctx.fillStyle = c.colour;
      ctx.fillRect(0, 0, 320, 4);
      F.drawText(ctx, c.fullName, 160, 14, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, 'CLUB OFFICE  -  SEASON ' + CC.Career.state.season, 160, 36, { align: 'center', color: P.cream });

      CC.ui.panel(ctx, 20, 54, 280, 82, P.grassDark);
      const row = (label, value, i) => {
        F.drawText(ctx, label, 30, 62 + i * 12, { color: P.cream });
        F.drawText(ctx, value, 290, 62 + i * 12, { color: P.white, align: 'right' });
      };
      const wages = CC.Career.wageBill();
      row('CHAMPIONSHIP', 'DIVISION ' + c.div, 0);
      row('T20 AND 50-OVER GROUP', c.group, 1);
      row('SQUAD', club.players.length + ' OF ' + CC.Squads.RULES.squadMax, 2);
      row('OVERSEAS PLAYERS', CC.Career.overseasCount() + ' (MAX ' + CC.Squads.RULES.maxOverseasXI + ' PER XI)', 3);
      row('WAGE BILL', wages + 'K OF ' + club.budget + 'K', 4);
      row('CONTRACTS ENDING THIS SEASON', String(club.players.filter(p => p.contract === 1).length), 5);

      F.drawText(ctx, 'FIXTURES AND COMPETITIONS COMING SOON', 160, 180, { align: 'center', color: P.greyLite });
      F.drawText(ctx, 'PLAY A FRIENDLY TO TRY YOUR SQUAD', 160, 192, { align: 'center', color: P.greyLite });
    },
  });
})();
