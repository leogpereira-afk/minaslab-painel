import { Component } from 'react';
import { ErroModulo } from './ui.jsx';

// Um erro de renderização não deve apagar a navegação do sistema inteiro.
export class LimiteModulo extends Component {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (this.state.falhou) return <ErroModulo mensagem="Esta tela encontrou um problema. Tente novamente ou escolha outro módulo no menu." aoTentar={() => this.setState({ falhou: false })} />;
    return this.props.children;
  }
}
