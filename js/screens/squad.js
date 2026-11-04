// Squad list for a county. In preview mode (choosing a county) it offers to
// take charge. Managing your own county, you pick a player (click, or the
// arrow keys) and then choose them for the XI, renew their contract or
// release them.
(function () {
  const P = CC.pal;
  const F = CC.font;
  const ROW = 8, TOP = 25;
  let clubId = null;
  let preview = false;
  let sel = 0;
  let msg = '';
  let confirmRelease = null;   // player id waiting for a second press of RELEASE

  // Column headings and one player row, shared with the transfer market.
  function drawHeader(ctx, y, lastCols) {
    const head = (t, x, align) => F.drawText(ctx, t, x, y, { color: P.cream, align });
    head('PLAYER', 4); head('AGE', 92, 'right'); head('ROLE', 98); head('TYPE', 126);
    head('BAT', 170, 'right'); head('BWL', 190, 'right'); head('FROM', 196);
    head(lastCols[0], 240, 'right'); head(lastCols[1], 276, 'right'); head(lastCols[2] || '', 290);
    ctx.fillStyle = P.cream;
    ctx.fillRect(4, y + 8, 312, 1);
  }

  function drawRow(ctx, p, y, opts) {
    const col = opts.dim ? P.greyLite : P.white;
    if (opts.selected) { ctx.fillStyle = P.blue; ctx.fillRect(2, y - 1, 316, ROW); }
    else if (opts.stripe) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(2, y - 1, 316, ROW); }
    F.drawText(ctx, p.name, 4, y, { color: col });
    F.drawText(ctx, String(p.age), 92, y, { color: col, align: 'right' });
    F.drawText(ctx, p.role, 98, y, { color: col });
    F.drawText(ctx, p.style || '-', 126, y, { color: col });
    F.drawText(ctx, String(p.bat), 170, y, { color: col, align: 'right' });
    F.drawText(ctx, String(p.bowl), 190, y, { color: col, align: 'right' });
    F.drawText(ctx, p.nation, 196, y, { color: p.overseas ? P.orange : col });
    F.drawText(ctx, p.contract + 'Y', 240, y, { color: p.contract === 1 && !opts.market ? P.orange : col, align: 'right' });
    F.drawText(ctx, p.wage + 'K', 276, y, { color: col, align: 'right' });
    if (opts.star) F.drawText(ctx, '*', 293, y, { color: P.yellow });
  }

  function players() { return CC.Career.club(clubId).players; }
  function selected() { return players()[Math.min(sel, players().length - 1)]; }

  // What to say about the selected player.
  function describe(p) {
    if (!p) return '';
    if (p.contract === 1) {
      const t = CC.Market.renewTerms(p);
      return p.name + ': LAST YEAR. RENEW ' + t.years + 'Y AT ' + t.wage + 'K?';
    }
    return p.name + ': CONTRACT ' + p.contract + ' SEASONS, ' + p.wage + 'K A YEAR';
  }

  function act(fn) {
    const p = selected();
    if (!p) return;
    const err = fn(p);
    if (err !== undefined) msg = err || '';
  }

  CC.engine.register('squad', {
    enter(params) {
      clubId = params.clubId || CC.Career.state.countyId;
      preview = !!params.preview;
      sel = 0;
      msg = '';
      confirmRelease = null;
      const ui = CC.ui;
      if (preview) {
        this.buttons = [
          ui.button(8, 241, 70, 'BACK', 'Escape', () => CC.engine.go('county')),
          ui.button(206, 241, 106, 'TAKE CHARGE', 'Enter', () => {
            CC.Career.takeCharge(clubId);
            CC.game.mode = 'career';
            CC.engine.go('office');
          }),
        ];
        return;
      }
      this.buttons = [
        ui.button(2, 241, 50, 'PICK', 'x', () => act(p => {
          confirmRelease = null;
          const e = CC.Career.toggleXI(p.id);
          return e || (CC.Career.club().selection.indexOf(p.id) >= 0 ? p.name + ' IS IN THE XI' : p.name + ' LEFT OUT');
        })),
        ui.button(54, 241, 50, 'AUTO XI', 'a', () => { CC.Career.autoXI(); msg = 'XI WILL BE PICKED AUTOMATICALLY'; }),
        ui.button(106, 241, 50, 'RENEW', 'r', () => act(p => { const e = CC.Career.renew(p.id); return e || p.name + ' SIGNS A NEW CONTRACT'; })),
        ui.button(158, 241, 50, 'RELEASE', 'd', () => act(p => {
          if (confirmRelease !== p.id) { confirmRelease = p.id; return 'PRESS RELEASE AGAIN TO RELEASE ' + p.name; }
          confirmRelease = null;
          const e = CC.Career.release(p.id);
          return e || p.name + ' RELEASED. WAGES COUNT TO SEASON END';
        })),
        ui.button(210, 241, 50, 'MARKET', 'm', () => CC.engine.go('market')),
        ui.button(262, 241, 56, 'BACK', 'Escape', () => CC.engine.go('office')),
      ];
    },

    onKey(key) {
      if (preview) return;
      if (key === 'ArrowDown') { sel = Math.min(players().length - 1, sel + 1); msg = ''; confirmRelease = null; }
      if (key === 'ArrowUp') { sel = Math.max(0, sel - 1); msg = ''; confirmRelease = null; }
    },

    onClick(x, y) {
      if (preview) return;
      const i = Math.floor((y - TOP + 1) / ROW);
      if (i >= 0 && i < players().length) { sel = i; msg = ''; confirmRelease = null; }
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const c = CC.Career.county(clubId);
      const club = CC.Career.club(clubId);
      const R = CC.Squads.RULES;
      ctx.fillStyle = c.colour;
      ctx.fillRect(4, 2, 4, 7);
      F.drawText(ctx, c.fullName + ' SQUAD', 12, 2, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, 'SEASON ' + CC.Career.state.season, 316, 2, { align: 'right', color: P.cream });
      drawHeader(ctx, 13, ['CON', 'WAGE', 'XI']);

      const mine = !preview && clubId === CC.Career.state.countyId;
      // Your own picks while you are choosing (even an incomplete XI), otherwise the XI that will play.
      const picked = mine && club.selection ? club.selection : (mine ? CC.Career.currentXI() : CC.Squads.pickXI(club.players)).map(p => p.id);
      club.players.forEach((p, i) => {
        const inXI = picked.indexOf(p.id) >= 0;
        drawRow(ctx, p, TOP + i * ROW, { dim: !inXI, star: inXI, stripe: i % 2, selected: mine && i === sel });
      });

      const info = 'SQUAD ' + club.players.length + '/' + R.squadMax +
        '  OVERSEAS ' + CC.Career.overseasCount(clubId) + '/' + R.maxOverseasSquad +
        '  WAGES ' + CC.Career.wageBill(clubId) + 'K/' + club.budget + 'K';
      F.drawText(ctx, info, 4, 220, { color: P.yellow });
      if (preview) {
        F.drawText(ctx, '* = BEST XI', 84, 244, { color: P.greyLite });
        return;
      }
      const warn = CC.Market.xiWarnings(CC.Career.state);
      const line = msg || (warn.length ? 'XI: ' + warn.join(', ') : describe(selected()));
      F.drawText(ctx, line, 4, 230, { color: msg ? P.white : warn.length ? P.orange : P.cream });
    },
  });

  CC.squadTable = { drawHeader, drawRow, ROW, TOP };
})();
