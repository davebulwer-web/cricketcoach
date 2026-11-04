// Squad list for a county. In preview mode (choosing a county) it offers to
// take charge; otherwise it returns to the club office.
(function () {
  const P = CC.pal;
  const F = CC.font;
  let clubId = null;
  let preview = false;

  CC.engine.register('squad', {
    enter(params) {
      clubId = params.clubId || CC.Career.state.countyId;
      preview = !!params.preview;
      this.buttons = preview ? [
        CC.ui.button(8, 238, 70, 'BACK', 'Escape', () => CC.engine.go('county')),
        CC.ui.button(206, 238, 106, 'TAKE CHARGE', 'Enter', () => {
          CC.Career.takeCharge(clubId);
          CC.game.mode = 'career';
          CC.engine.go('office');
        }),
      ] : [
        CC.ui.button(242, 238, 70, 'BACK', 'Escape', () => CC.engine.go('office')),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const c = CC.Career.county(clubId);
      const club = CC.Career.club(clubId);
      ctx.fillStyle = c.colour;
      ctx.fillRect(4, 3, 4, 7);
      F.drawText(ctx, c.fullName + ' SQUAD', 12, 3, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, 'SEASON ' + CC.Career.state.season, 316, 3, { align: 'right', color: P.cream });

      const hy = 15;
      const head = (t, x, align) => F.drawText(ctx, t, x, hy, { color: P.cream, align });
      head('PLAYER', 4); head('AGE', 92, 'right'); head('ROLE', 98); head('TYPE', 126);
      head('BAT', 170, 'right'); head('BWL', 190, 'right'); head('FROM', 196); head('CON', 240, 'right');
      head('WAGE', 270, 'right'); head('XI', 290);
      ctx.fillStyle = P.cream;
      ctx.fillRect(4, hy + 8, 312, 1);

      const xi = CC.Squads.pickXI(club.players);
      club.players.forEach((p, i) => {
        const y = 26 + i * 9;
        const inXI = xi.indexOf(p) >= 0;
        const col = inXI ? P.white : P.greyLite;
        if (i % 2) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(2, y - 1, 316, 9); }
        F.drawText(ctx, p.name, 4, y, { color: col });
        F.drawText(ctx, String(p.age), 92, y, { color: col, align: 'right' });
        F.drawText(ctx, p.role, 98, y, { color: col });
        F.drawText(ctx, p.style || '-', 126, y, { color: col });
        F.drawText(ctx, String(p.bat), 170, y, { color: col, align: 'right' });
        F.drawText(ctx, String(p.bowl), 190, y, { color: col, align: 'right' });
        F.drawText(ctx, p.nation, 196, y, { color: p.overseas ? P.orange : col });
        F.drawText(ctx, p.contract + 'Y', 240, y, { color: col, align: 'right' });
        F.drawText(ctx, p.wage + 'K', 270, y, { color: col, align: 'right' });
        if (inXI) F.drawText(ctx, '*', 293, y, { color: P.yellow });
      });

      const wages = CC.Career.wageBill(clubId);
      const os = CC.Career.overseasCount(clubId);
      const info = 'SQUAD ' + club.players.length + '/' + CC.Squads.RULES.squadMax +
        '  OVERSEAS ' + os + '  WAGES ' + wages + 'K OF ' + club.budget + 'K';
      F.drawText(ctx, info, 4, 226, { color: P.yellow });
      if (preview) F.drawText(ctx, '* = BEST XI', 84, 241, { color: P.greyLite });
      else F.drawText(ctx, '* = BEST XI   ORANGE = OVERSEAS', 4, 241, { color: P.greyLite });
    },
  });
})();
