// What happened at your county over the close season.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('closeseason', {
    enter() {
      this.buttons = [CC.ui.button(222, 238, 90, 'CONTINUE', 'Enter', () => CC.engine.go('office'))];
    },

    draw(ctx) {
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      const st = CC.Career.state;
      const n = st.news || { retired: [], left: [], youth: [], kept: [] };
      F.drawText(ctx, 'CLOSE SEASON', 160, 8, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, CC.Career.myCounty().fullName + ' - READY FOR ' + st.season, 160, 28, { align: 'center', color: P.cream });
      let y = 44;
      const section = (title, names, none) => {
        F.drawText(ctx, title, 20, y, { color: P.yellow });
        y += 10;
        // Wrap the names over as many lines as needed, never splitting a name.
        const parts = names.length ? names.map((nm, i) => nm + (i < names.length - 1 ? ', ' : '')) : [none];
        let line = '';
        parts.forEach(part => {
          if ((line + part).length > 46) { F.drawText(ctx, line, 28, y); y += 9; line = ''; }
          line += part;
        });
        F.drawText(ctx, line, 28, y, { color: names.length ? P.white : P.greyLite });
        y += 14;
      };
      section('RETIRED', n.retired, 'NOBODY');
      section('CONTRACTS ENDED, LEFT THE CLUB', n.left, 'NOBODY');
      if (n.kept.length) section('KEPT ON A ONE-YEAR DEAL (SQUAD MINIMUM)', n.kept, '');
      section('JOINED FROM THE ACADEMY', n.youth, 'NOBODY');
      F.drawText(ctx, 'EVERYONE IS A YEAR OLDER: YOUNG PLAYERS', 20, 196, { color: P.cream });
      F.drawText(ctx, 'IMPROVE, OLDER ONES SLOWLY DECLINE.', 20, 206, { color: P.cream });
      F.drawText(ctx, 'THE TRANSFER WINDOW IS OPEN.', 20, 216, { color: P.cream });
    },
  });
})();
