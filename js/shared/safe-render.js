// Safe text highlighting helpers. Prevents HTML/script injection.
(function initSafeRender(global) {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function buildHighlightedHtmlFromOriginal(result, spanBuilder) {
    const original = String(result?.original || "");
    const entities = Array.isArray(result?.entities) ? [...result.entities] : [];
    entities.sort((a, b) => (a.position?.start || 0) - (b.position?.start || 0));

    let cursor = 0;
    let html = "";

    entities.forEach((entity, index) => {
      const start = clamp(Number(entity?.position?.start || 0), 0, original.length);
      const end = clamp(Number(entity?.position?.end || 0), 0, original.length);
      if (end <= start || start < cursor) return;

      html += escapeHtml(original.slice(cursor, start));
      html += spanBuilder(entity, index, { escapeHtml, escapeAttr });
      cursor = end;
    });

    html += escapeHtml(original.slice(cursor));
    return html;
  }

  function toParagraphsHtml(highlightedHtml) {
    return highlightedHtml
      .split(/\n\s*\n/)
      .filter((block) => block.trim())
      .map((block) => '<p class="mb-6">' + block.replace(/\n/g, "<br/>") + "</p>")
      .join("") + '<div class="h-32"></div>';
  }

  global.SafeRender = {
    escapeHtml,
    escapeAttr,
    buildHighlightedHtmlFromOriginal,
    toParagraphsHtml
  };
})(window);
