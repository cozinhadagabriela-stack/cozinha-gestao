// ===== Auth =====
auth.onAuthStateChanged((user) => {
  updateUI(user);
});

loginButton.addEventListener("click", async () => {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  loginError.textContent = "";
  saleMessage.textContent = "";
  saleMessage.className = "msg";
  loadingLabel.classList.remove("hidden");

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error(error);
    let msg = "Erro ao fazer login.";
    if (error.code === "auth/user-not-found") msg = "Usuário não encontrado.";
    else if (error.code === "auth/wrong-password") msg = "Senha incorreta.";
    else if (error.code === "auth/invalid-email") msg = "E-mail inválido.";
    loginError.textContent = msg;
  } finally {
    loadingLabel.classList.add("hidden");
  }
});

logoutButton.addEventListener("click", async () => {
  await auth.signOut();
});
