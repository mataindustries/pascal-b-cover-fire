import './styles.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Application root was not found.');

const game = new Game(app);

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy());
}
