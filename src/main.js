import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import './ui.css';

document.fonts.load('12px RicamoSymbols').catch(()=>{}).finally(()=>createApp(App).mount('#app'));
