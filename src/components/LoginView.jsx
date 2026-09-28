import React, { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';

export default function LoginView({ onEntrar }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const erroRef = useRef(null);
  const loginRef = useRef(null);

  useEffect(() => {
    loginRef.current?.focus();
  }, []);

  useEffect(() => {
    if (erro) erroRef.current?.focus();
  }, [erro]);

  const enviar = async (evento) => {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await onEntrar(login, senha);
    } catch (falha) {
      setErro(falha?.message || 'Falha no login');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={enviar} autoComplete="off">
        <div className="login-brand">
          <div className="logo-badge">P</div>
          <div>
            <div className="logo-text">Piu Mobile</div>
            <div className="logo-sub">Design &amp; Engenharia</div>
          </div>
        </div>

        <p className="page-subtitle">Acesso interno. Use seu usuário da produção.</p>

        <div className="form-group">
          <label className="form-label" htmlFor="login-usuario">Usuário</label>
          <input
            id="login-usuario"
            ref={loginRef}
            className="form-input login-input-caps"
            value={login}
            onChange={(evento) => {
              setLogin(evento.target.value.toUpperCase());
              setErro('');
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={erro ? 'true' : undefined}
            aria-describedby={erro ? 'login-erro' : undefined}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            type="password"
            className="form-input"
            value={senha}
            onChange={(evento) => {
              setSenha(evento.target.value);
              setErro('');
            }}
            autoComplete="current-password"
            aria-invalid={erro ? 'true' : undefined}
            aria-describedby={erro ? 'login-erro' : undefined}
          />
        </div>

        {erro && (
          <p className="form-error" id="login-erro" role="alert" tabIndex={-1} ref={erroRef}>
            {erro}
          </p>
        )}

        <button className="btn-primary login-submit" type="submit" disabled={enviando}>
          <LogIn size={16} aria-hidden="true" />
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="login-hint">Login somente em CAIXA ALTA.</p>
      </form>
    </div>
  );
}
