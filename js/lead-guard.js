/**
 * Lead Guard — blindagem anti-perda do formulário (ADR-0015, 14/08/2026).
 *
 * Problema que resolve: até 14/08/2026 o formulário mandava o cadastro uma vez
 * só, com timeout de 3s, e engolia qualquer falha num catch vazio. Timeout,
 * erro do servidor ou oscilação de rede (o dia do incidente teve picos de 4s no
 * cabo internacional) resultavam no lead vendo a página de obrigado sem ter
 * sido gravado. Ninguém dos dois lados ficava sabendo.
 *
 * Como funciona:
 *   1. O payload vai pro localStorage ANTES do primeiro envio.
 *   2. Envia com tentativas repetidas e espera crescente.
 *   3. Última cartada: sendBeacon, que sobrevive à saída da página.
 *   4. Só apaga do localStorage com confirmação de gravação (ok:true).
 *   5. As páginas de obrigado chamam reenviarPendente() e terminam o serviço
 *      em silêncio, sem o lead perceber nada.
 *
 * O servidor deduplica por email e telefone, então reenvio nunca cria lead
 * duplicado: vira atualização do mesmo registro.
 */
(function (global) {
  "use strict";

  var CHAVE = "_krob_pending_lead";
  var VALIDADE_MS = 24 * 60 * 60 * 1000; // 24h: depois disso o dado envelheceu
  var ENDPOINT = "/lp/submit";

  function agora() { return Date.now(); }

  function salvar(payload) {
    try {
      global.localStorage.setItem(CHAVE, JSON.stringify({
        payload: payload,
        criadoEm: agora(),
        tentativas: 0,
      }));
    } catch (e) { /* modo privado ou storage cheio: segue sem rede de segurança */ }
  }

  function lerPendente() {
    try {
      var cru = global.localStorage.getItem(CHAVE);
      if (!cru) return null;
      var item = JSON.parse(cru);
      if (!item || !item.payload) return null;
      if (agora() - (item.criadoEm || 0) > VALIDADE_MS) { limpar(); return null; }
      return item;
    } catch (e) { return null; }
  }

  function limpar() {
    try { global.localStorage.removeItem(CHAVE); } catch (e) { /* nada a fazer */ }
  }

  function marcarTentativa() {
    var item = lerPendente();
    if (!item) return;
    item.tentativas = (item.tentativas || 0) + 1;
    try { global.localStorage.setItem(CHAVE, JSON.stringify(item)); } catch (e) { /* idem */ }
  }

  function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function postar(payload, timeoutMs) {
    return Promise.race([
      fetch(ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().catch(function () { return { ok: r.ok }; });
      }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("timeout")); }, timeoutMs);
      }),
    ]);
  }

  function beacon(payload) {
    try {
      if (!global.navigator || !global.navigator.sendBeacon) return false;
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      return global.navigator.sendBeacon(ENDPOINT, blob);
    } catch (e) { return false; }
  }

  /**
   * Envia com insistência. Devolve a resposta do servidor no sucesso, ou null
   * se todas as tentativas falharam (nesse caso o payload segue guardado).
   *
   * Padrão de 2 tentativas curtas (3s + 3,5s, espera 0,5s, teto ~7s): esta
   * chamada roda ANTES do redirect da página, então o lead está olhando a
   * tela. Insistir demais aqui (a versão original tentava 3x até 5s, teto de
   * ~14s) trocaria uma espera curta por uma longa sem necessidade: se ainda
   * assim falhar, o payload continua guardado e a página de obrigado termina
   * o serviço em silêncio, com janela bem mais folgada (ver reenviarPendente).
   */
  async function enviar(payload, opts) {
    opts = opts || {};
    var timeouts = opts.timeouts || [3000, 3500];
    var esperas = opts.esperas || [500];

    for (var i = 0; i < timeouts.length; i++) {
      try {
        marcarTentativa();
        var resp = await postar(payload, timeouts[i]);
        if (resp && resp.ok) { limpar(); return resp; }
        // ok:false SEM retry é recusa definitiva (validação): não adianta
        // insistir, mas o registro fica no dead letter do servidor.
        if (resp && resp.ok === false && !resp.retry) { limpar(); return resp; }
      } catch (e) { /* rede, timeout ou 5xx: tenta de novo */ }
      if (i < esperas.length) await esperar(esperas[i]);
    }

    // Última cartada: dispara e sai. Não dá pra confirmar, então o payload
    // continua guardado e a página de obrigado tenta de novo.
    beacon(payload);
    return null;
  }

  /**
   * Chamado pelas páginas de obrigado. Se sobrou cadastro pendente, termina o
   * envio em silêncio. Não bloqueia nada da página.
   */
  function reenviarPendente() {
    var item = lerPendente();
    if (!item) return Promise.resolve(null);
    return enviar(item.payload, { timeouts: [6000, 8000], esperas: [2000] })
      .catch(function () { return null; });
  }

  global.KrobLeadGuard = {
    salvar: salvar,
    enviar: enviar,
    limpar: limpar,
    lerPendente: lerPendente,
    reenviarPendente: reenviarPendente,
  };
})(window);
