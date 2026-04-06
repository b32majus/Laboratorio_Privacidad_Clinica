// Floating global action to clear sensitive session data.
(function initSessionControls(global) {
  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "global-clear-session-btn";
    button.textContent = "Borrar sesion";
    button.setAttribute("aria-label", "Borrar sesion clinica");
    button.style.position = "fixed";
    button.style.right = "16px";
    button.style.bottom = "16px";
    button.style.zIndex = "9999";
    button.style.border = "1px solid #d4d0cc";
    button.style.background = "#ffffff";
    button.style.color = "#2d2926";
    button.style.borderRadius = "9999px";
    button.style.padding = "10px 14px";
    button.style.fontSize = "12px";
    button.style.fontWeight = "600";
    button.style.boxShadow = "0 4px 10px rgba(0,0,0,0.12)";
    button.style.cursor = "pointer";
    return button;
  }

  function attach() {
    if (document.getElementById("global-clear-session-btn")) return;
    const button = createButton();
    button.addEventListener("click", () => {
      const shouldClear = confirm("Se borraran los datos de sesion. Deseas continuar?");
      if (!shouldClear) return;

      if (global.AppSession && typeof global.AppSession.clearAllSensitiveData === "function") {
        global.AppSession.clearAllSensitiveData();
      } else {
        try {
          sessionStorage.clear();
        } catch (error) {
          // no-op
        }
      }
      alert("Sesion clinica borrada.");
    });
    document.body.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded", attach);
})(window);
