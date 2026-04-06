// Shared error handling helpers for consistent UX.
(function initAppErrors(global) {
  function getMessage(error, fallbackMessage) {
    if (!error) return fallbackMessage;
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    return fallbackMessage;
  }

  function alertError(context, error, fallbackMessage) {
    const message = getMessage(error, fallbackMessage || "Ha ocurrido un error inesperado.");
    const fullMessage = context ? context + ": " + message : message;
    console.error(fullMessage, error);
    alert(fullMessage);
  }

  global.AppErrors = {
    getMessage,
    alertError
  };
})(window);
