/** Chave no localStorage com a escolha do tema ("light" | "dark"). */
export const THEME_KEY = "routa-theme";

/**
 * Roda no <head> antes de a página aparecer (sem piscar).
 * Padrão: escuro. Só fica claro se a pessoa escolheu claro antes.
 */
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
