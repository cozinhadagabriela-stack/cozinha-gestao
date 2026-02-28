// Configuração do Firebase da Cozinha da Gabriela - Gestão
const firebaseConfig = {
  apiKey: "AIzaSyAq9cOdOE3748_4hLnnzNnKtbFmB_jGuOw",
  authDomain: "cozinha-da-gabriela-gestao.firebaseapp.com",
  projectId: "cozinha-da-gabriela-gestao",
  storageBucket: "cozinha-da-gabriela-gestao.firebasestorage.app",
  messagingSenderId: "300585467426",
  appId: "1:300585467426:web:5c2cb7ac643d1ec738147b"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Deixa auth e db globais para o app.js usar
const auth = firebase.auth();
const db = firebase.firestore();
