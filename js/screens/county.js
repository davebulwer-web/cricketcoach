// New career: choose which of the 18 counties to manage.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('county', {
    enter() {
      this.buttons = CC.counties.map((c, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const label = (c.fullName + '                 ').slice(0, 17) + 'DIV ' + c.div;
        const b = CC.ui.button(8 + col * 156, 34 + row * 16, 148, label, null,
          () => CC.engine.go('squad', { clubId: c.id, preview: true }));
        b.align = 'left';
        return b;
      });
      this.buttons.push(CC.ui.button(8, 238, 70, 'BACK', 'Escape', () => CC.engine.go('title')));
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      F.drawText(ctx, 'CHOOSE YOUR COUNTY', 160, 6, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, 'SEASON ' + CC.Career.state.season + '  -  PICK A CLUB TO VIEW ITS SQUAD', 160, 22, { align: 'center', color: P.cream });
      // Team colour swatches beside each button.
      CC.counties.forEach((c, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        ctx.fillStyle = c.colour;
        ctx.fillRect(3 + col * 156, 37 + row * 16, 3, 7);
      });
      F.drawText(ctx, 'DIVISION = FOUR-DAY CHAMPIONSHIP', 312, 242, { align: 'right', color: P.greyLite });
    },
  });
})();
