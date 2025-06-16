let app;
// main.js - Versão completa integrada
document.addEventListener('DOMContentLoaded', function () {
    // 1. Configurações iniciais
    const config = {
        apiBaseUrl: 'http://localhost:8080',
        defaultCover: 'https://via.placeholder.com/300/181818/282828?text=🎵'
    };

    // 2. Verificar autenticação e obter dados do usuário
    function checkAuthentication() {
        const token = sessionStorage.getItem('authToken');
        const user = sessionStorage.getItem('currentUser');

        if (!token || !user) {
            window.location.href = 'login.html';
            return false;
        }

        // Exibir nome do usuário
        try {
            const userData = JSON.parse(user);
            if (userData && userData.nome) {
                document.getElementById('welcomeMessage').textContent = `Bem-vindo, ${userData.nome}`;
            }
            return userData;
        } catch (e) {
            console.error("Erro ao parsear dados do usuário:", e);
            return false;
        }
    }

    const userData = checkAuthentication();
    if (!userData) return;

    const userId = userData.id;
    const userName = userData.nome || 'Usuário';

    // 3. Elementos do DOM
    const elements = {
        // Header
        welcomeMessage: document.getElementById('welcomeMessage'),
        searchInput: document.getElementById('searchInput'),
        searchButton: document.getElementById('searchButton'),
        clearSearch: document.getElementById('clearSearch'),

        // Conteúdo principal
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        radiosContainer: document.getElementById('radiosContainer'),

        // Sidebar
        userPlaylists: document.getElementById('userPlaylists'),

        // Modal
        musicModal: document.getElementById('musicModal'),
        musicList: document.getElementById('musicList'),
        modalHeader: document.getElementById('modalHeader'),
        modalRadioName: document.getElementById('modalRadioName'),
        closeModal: document.getElementById('closeModal'),
        musicLoading: document.getElementById('musicLoading'),
        musicError: document.getElementById('musicError'),

        // Player
        nowPlaying: document.getElementById('nowPlaying'),
        nowPlayingCover: document.getElementById('nowPlayingCover'),
        nowPlayingTitle: document.getElementById('nowPlayingTitle'),
        nowPlayingArtist: document.getElementById('nowPlayingArtist'),
        playPauseBtn: document.getElementById('playPauseBtn'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        progressBar: document.getElementById('progressBar'),
        currentTime: document.getElementById('currentTime'),
        duration: document.getElementById('duration'),
        volumeSlider: document.getElementById('volumeSlider'),
        volumeDown: document.getElementById('volumeDown'),
        volumeUp: document.getElementById('volumeUp')
    };

    // 4. Estado da aplicação (mantendo a estrutura original do player)
    const playerState = {
        currentRadio: null,
        currentPlaylist: null,
        currentMusic: null,
        isPlaying: false,
        audioPlayer: new Audio(),
        playlist: [],
        currentIndex: -1,
        progressInterval: null,
        userPlaylists: [],
        favoritePlaylists: [],

        resetPlayer: function () {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.src = '';
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            this.isPlaying = false;
            if (elements.playPauseBtn) {
                elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    };

    // 5. Funções utilitárias (combinando ambas as versões)
    const utils = {
        formatDuration: (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        },

        handleError: (element, message) => {
            console.error(message);
            if (element) {
                element.textContent = message;
                element.style.display = 'block';
            }
            if (elements.loading) {
                elements.loading.style.display = 'none';
            }
        },

        showLoading: () => {
            if (elements.loading) elements.loading.style.display = 'block';
            if (elements.error) elements.error.style.display = 'none';
        },

        hideLoading: () => {
            if (elements.loading) elements.loading.style.display = 'none';
        },

        checkTextOverflow: () => {
            const check = () => {
                const elementsToCheck = [
                    elements.nowPlayingTitle,
                    elements.nowPlayingArtist
                ];

                elementsToCheck.forEach(element => {
                    if (element) {
                        if (element.scrollWidth > element.offsetWidth) {
                            element.classList.add('marquee');
                        } else {
                            element.classList.remove('marquee');
                        }
                    }
                });
            };

            setInterval(check, 500);
        }
    };

    // 6. Funções da API (mantendo a estrutura original)
    const api = {
        request: async (url, options = {}) => {
            const token = sessionStorage.getItem('authToken');

            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            };

            const finalOptions = {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...options.headers
                }
            };

            const response = await fetch(url, finalOptions);

            if (response.status === 401) {
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('currentUser');
                alert('Sessão expirada. Faça login novamente.');
                window.location.href = 'login.html';
                return;
            }

            return response;
        },

        getUserPlaylists: async () => {
            const response = await api.request(`${config.apiBaseUrl}/api/usuario-playlists/${userId}`);
            if (!response || !response.ok) return [];
            return await response.json();
        },

        getFavoritePlaylists: async () => {
            const response = await api.request(`${config.apiBaseUrl}/api/usuario-playlist-favoritas/${userId}`);
            if (!response || !response.ok) return [];
            return await response.json();
        },

        getFavoriteSongs: async () => {
            const response = await api.request(`${config.apiBaseUrl}/api/musicas-favoritas/${userId}`);
            if (!response || !response.ok) return [];
            return await response.json();
        },

        getPlaylistSongs: async (playlistId) => {
            try {
                const response = await api.request(`${config.apiBaseUrl}/api/playlist/${playlistId}/musicas`);
                if (!response || !response.ok) {
                    throw new Error(`Erro ${response?.status || 'na conexão'}`);
                }

                const songs = await response.json();

                // Verifica se a resposta é um array vazio
                if (!Array.isArray(songs) || songs.length === 0) {
                    throw new Error('Playlist vazia');
                }

                return songs;
            } catch (error) {
                console.error('Erro ao buscar músicas da playlist:', error);
                throw error; // Re-lança o erro para ser tratado pelo chamador
            }
        },


        search: async (query) => {
            const response = await api.request(`${config.apiBaseUrl}/api/search?termo=${encodeURIComponent(query)}`);
            if (!response || !response.ok) return null;
            return await response.json();
        },

        getRadios: async () => {
            const response = await api.request(`${config.apiBaseUrl}/api/radios`);
            if (!response || !response.ok) return [];
            return await response.json();
        },

        getRadioPlaylists: async (radioId) => {
            const response = await api.request(`${config.apiBaseUrl}/api/radios/${radioId}/playlists`);
            if (!response || !response.ok) return [];
            return await response.json();
        },

        getPlaylistMusicas: async (radioId, playlistId) => {
            const response = await api.request(`${config.apiBaseUrl}/api/radios/${radioId}/playlists/${playlistId}/musicas`);
            if (!response || !response.ok) return [];
            return await response.json();
        }
    };

    // 7. Aplicação principal (integrando ambas as versões)
    const app = {
        init: function () {
            // Configurar mensagem de boas-vindas
            if (elements.welcomeMessage) {
                elements.welcomeMessage.textContent = `Bem-vindo, ${userName}`;
            }

            // Configurar event listeners
            this.setupEventListeners();

            // Verificar overflow de texto
            utils.checkTextOverflow();

            // Carregar dados iniciais
            this.loadInitialData();
        },

        setupEventListeners: function () {
            document.querySelector('.logo-container')?.addEventListener('click', () => this.loadPlaylists());

            // Menu item
            document.querySelector('.menu-item')?.addEventListener('click', () => this.loadPlaylists());

            // Breadcrumb (adicione uma classe para facilitar)
            document.querySelectorAll('.breadcrumb span').forEach(el => {
                el.addEventListener('click', () => this.loadRadios());
            });

            // Botão de voltar (adicione uma classe)
            document.querySelectorAll('.empty-playlist-message button').forEach(el => {
                el.addEventListener('click', () => this.loadPlaylists());
            });
            // Pesquisa
            if (elements.searchButton) {
                elements.searchButton.addEventListener('click', () => this.performSearch());
            }

            if (elements.searchInput) {
                elements.searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') this.performSearch();
                });
            }

            if (elements.clearSearch) {
                elements.clearSearch.addEventListener('click', () => this.clearSearch());
            }

            // Player
            if (elements.playPauseBtn) {
                elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
            }

            if (elements.nextBtn) {
                elements.nextBtn.addEventListener('click', () => this.playNext());
            }

            if (elements.prevBtn) {
                elements.prevBtn.addEventListener('click', () => this.playPrevious());
            }

            // Modal
            if (elements.closeModal) {
                elements.closeModal.addEventListener('click', () => this.closeMusicModal());
            }

            // Volume
            if (elements.volumeSlider) {
                elements.volumeSlider.addEventListener('input', (e) => {
                    playerState.audioPlayer.volume = e.target.value;
                });
            }

            if (elements.volumeDown) {
                elements.volumeDown.addEventListener('click', () => {
                    playerState.audioPlayer.volume = Math.max(0, playerState.audioPlayer.volume - 0.1);
                    elements.volumeSlider.value = playerState.audioPlayer.volume;
                });
            }

            if (elements.volumeUp) {
                elements.volumeUp.addEventListener('click', () => {
                    playerState.audioPlayer.volume = Math.min(1, playerState.audioPlayer.volume + 0.1);
                    elements.volumeSlider.value = playerState.audioPlayer.volume;
                });
            }

            // Barra de progresso
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.addEventListener('click', (e) => {
                    if (!playerState.audioPlayer.duration) return;

                    const clickPosition = e.clientX - progressContainer.getBoundingClientRect().left;
                    const percentClicked = (clickPosition / progressContainer.clientWidth);
                    playerState.audioPlayer.currentTime = percentClicked * playerState.audioPlayer.duration;
                });
            }
        },

        loadInitialData: async function () {
            utils.showLoading();

            try {
                // Carregar playlists do usuário e favoritas em paralelo
                const [playlists, favorites] = await Promise.all([
                    api.getUserPlaylists(),
                    api.getFavoritePlaylists()
                ]);

                playerState.userPlaylists = playlists;
                playerState.favoritePlaylists = favorites;

                // Exibir playlists na sidebar
                this.displayUserPlaylists();

                // Carregar conteúdo inicial (rádios)
                this.loadRadios();

            } catch (error) {
                utils.handleError(elements.error, `Erro ao carregar dados: ${error.message}`);
            } finally {
                utils.hideLoading();
            }
        },

        displayUserPlaylists: function () {
            if (!elements.userPlaylists) return;

            elements.userPlaylists.innerHTML = '';

            // Playlist de músicas curtidas (especial)
            const favoritesItem = document.createElement('div');
            favoritesItem.className = 'playlist favorites';
            favoritesItem.innerHTML = `
                <div class="playlist-title">Músicas Curtidas</div>
                <div class="playlist-info">Playlist</div>
            `;
            favoritesItem.addEventListener('click', () => this.loadFavoriteSongs());
            elements.userPlaylists.appendChild(favoritesItem);

            // Demais playlists do usuário
            playerState.userPlaylists.forEach(playlist => {
                const isFavorite = playerState.favoritePlaylists.some(fav => fav.playlistId === playlist.id);
                const playlistElement = document.createElement('div');
                playlistElement.className = `playlist ${isFavorite ? 'favorite' : ''}`;
                playlistElement.innerHTML = `
                    <div class="playlist-title">${playlist.nome}</div>
                    <div class="playlist-info">${playlist.descricao || 'Playlist'}</div>
                `;

                playlistElement.addEventListener('click', () => {
                    this.openUserPlaylist(playlist);
                });

                elements.userPlaylists.appendChild(playlistElement);
            });
        },

        loadFavoriteSongs: async function () {
            utils.showLoading();
            elements.radiosContainer.innerHTML = '';

            try {
                const favoriteSongs = await api.getFavoriteSongs();
                if (!favoriteSongs || favoriteSongs.length === 0) {
                    throw new Error('Nenhuma música favorita encontrada');
                }

                // Criar uma "rádio" fictícia para as músicas favoritas
                const favoriteRadio = {
                    id: 'favorites',
                    nome: 'Músicas Curtidas',
                    capaUrl: config.defaultCover
                };

                // Exibir como uma playlist especial
                this.displaySongsAsPlaylist(favoriteRadio, favoriteSongs);

            } catch (error) {
                utils.handleError(elements.error, `Erro ao carregar favoritas: ${error.message}`);
            } finally {
                utils.hideLoading();
            }
        },
        openUserPlaylist: async function (playlist) {
            elements.musicModal.style.display = 'block';
            elements.modalHeader.style.backgroundImage = `url('${playlist.capaUrl || config.defaultCover}')`;
            elements.modalRadioName.textContent = playlist.nome;

            try {
                elements.musicLoading.style.display = 'block';
                elements.musicError.style.display = 'none';
                elements.musicList.innerHTML = '';

                const songs = await api.getPlaylistSongs(playlist.id);
                playerState.playlist = songs;
                this.displayMusicas(songs);

            } catch (error) {
                let errorMessage = `Erro ao carregar músicas: ${error.message}`;

                if (error.message.includes('vazia')) {
                    errorMessage = 'Esta playlist está vazia';
                    // Mostra mensagem mais amigável para playlists vazias
                    elements.musicList.innerHTML = `
                <div class="empty-playlist-message">
                    <i class="fas fa-music"></i>
                    <p>Esta playlist está vazia</p>
                    <button onclick="app.loadPlaylists()">Voltar para playlists</button>
                </div>
            `;
                } else {
                    utils.handleError(elements.musicError, errorMessage);
                }
            } finally {
                elements.musicLoading.style.display = 'none';
            }
        },
        loadPlaylists: async () => {
        try {
            elements.loading.style.display = 'block';
            const response = await fetch(`${config.apiBaseUrl}/api/radios`);
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            
            const radios = await response.json(); // Agora recebe diretamente as rádios
            app.displayRadios(radios); // Renomeie esta função para melhor clareza
        } catch (error) {
            utils.handleError(elements.error, `Erro ao carregar rádios: ${error.message}`);
        } finally {
            elements.loading.style.display = 'none';
        }
    },


        loadRadios: async function () {
            utils.showLoading();
            elements.radiosContainer.innerHTML = '';

            try {
                const radios = await api.getRadios();
                if (!radios || radios.length === 0) {
                    throw new Error('Nenhuma rádio encontrada');
                }

                this.displayRadios(radios);

            } catch (error) {
                utils.handleError(elements.error, `Erro ao carregar rádios: ${error.message}`);
            } finally {
                utils.hideLoading();
            }
        },

        displayRadios: function (radios) {
            if (!elements.radiosContainer) return;

            elements.radiosContainer.innerHTML = '';

            radios.forEach(radio => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="cover-container">
                        <div class="cover-image" style="background-image: url('${radio.capaUrl || config.defaultCover}')"></div>
                        <div class="play-overlay">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="card-title">${radio.nome}</div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    this.openRadioPlaylists(radio);
                });

                elements.radiosContainer.appendChild(card);
            });
        },

        openRadioPlaylists: async function (radio) {
            try {
                utils.showLoading();
                const playlists = await api.getRadioPlaylists(radio.id);
                if (!playlists || playlists.length === 0) {
                    throw new Error('Nenhuma playlist encontrada para esta rádio');
                }

                this.displayPlaylists(radio, playlists);
            } catch (error) {
                utils.handleError(elements.error, `Erro ao carregar playlists: ${error.message}`);
            } finally {
                utils.hideLoading();
            }
        },

        displayPlaylists: function (radio, playlists) {
            elements.radiosContainer.innerHTML = `
                <div class="breadcrumb">
                    <span onclick="app.loadRadios()">Rádios</span> > ${radio.nome}
                </div>
            `;

            playlists.forEach(playlist => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="cover-container">
                        <div class="cover-image" style="background-image: url('${playlist.capaUrl || radio.capaUrl || config.defaultCover}')"></div>
                    </div>
                    <div class="card-info">
                        <div class="card-title">${playlist.nome}</div>
                        <div class="card-subtitle">${playlist.descricao || 'Playlist de músicas'}</div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    this.openPlaylistMusicas(radio, playlist);
                });

                elements.radiosContainer.appendChild(card);
            });
        },

        openPlaylistMusicas: async function (radio, playlist) {
            playerState.currentRadio = radio;
            playerState.currentPlaylist = playlist;

            elements.musicModal.style.display = 'block';
            elements.modalHeader.style.backgroundImage = `url('${playlist.capaUrl || radio.capaUrl || config.defaultCover}')`;
            elements.modalRadioName.textContent = `${radio.nome} - ${playlist.nome}`;

            try {
                elements.musicLoading.style.display = 'block';
                const musicas = await api.getPlaylistMusicas(radio.id, playlist.id);
                if (!musicas || musicas.length === 0) {
                    throw new Error('Nenhuma música encontrada nesta playlist');
                }

                playerState.playlist = musicas;
                this.displayMusicas(musicas);
            } catch (error) {
                utils.handleError(elements.musicError, `Erro ao carregar músicas: ${error.message}`);
            } finally {
                elements.musicLoading.style.display = 'none';
            }
        },

        displaySongsAsPlaylist: function (radio, songs) {
            elements.radiosContainer.innerHTML = `
                <div class="breadcrumb">
                    <span onclick="app.loadRadios()">Início</span> > ${radio.nome}
                </div>
                <h2 class="section-title">${radio.nome}</h2>
            `;

            songs.forEach((song, index) => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="cover-container">
                        <div class="cover-image" style="background-image: url('${song.capaUrl || radio.capaUrl || config.defaultCover}')"></div>
                        <div class="play-overlay">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="card-title">${song.titulo}</div>
                        <div class="card-subtitle">${song.artista}</div>
                        <div class="card-duration">${utils.formatDuration(song.duracaoSegundos)}</div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    playerState.currentRadio = radio;
                    playerState.playlist = songs;
                    this.playMusic(index);
                });

                elements.radiosContainer.appendChild(card);
            });
        },

        displayMusicas: function (musicas) {
            if (!elements.musicList) return;

            elements.musicList.innerHTML = '';

            if (!musicas || musicas.length === 0) {
                elements.musicList.innerHTML = `
            <div class="empty-playlist-message">
                <i class="fas fa-music"></i>
                <p>Nenhuma música encontrada</p>
            </div>
        `;
                return;
            }
            if (!elements.musicList) return;

            elements.musicList.innerHTML = '';

            musicas.forEach((musica, index) => {
                const card = document.createElement('div');
                card.className = 'music';
                card.innerHTML = `
                    <div class="music-container">
                        <div class="music-image" style="background-image: url('${musica.capaUrl || playerState.currentRadio.capaUrl || config.defaultCover}')"></div>
                        <div class="play-overlay">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                    <div class="music-info">
                        <div class="music-title">${musica.titulo}</div>
                        <div class="music-subtitle">${musica.artista}</div>
                        <div class="music-duration">${utils.formatDuration(musica.duracaoSegundos)}</div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    this.playMusic(index);
                });

                elements.musicList.appendChild(card);
            });
        },

        performSearch: async function () {
            const term = elements.searchInput ? elements.searchInput.value.trim() : '';

            if (!term) {
                await this.loadRadios();
                return;
            }

            utils.showLoading();
            elements.radiosContainer.innerHTML = '';

            try {
                const result = await api.search(term);
                if (!result) {
                    throw new Error('Nenhum resultado encontrado');
                }

                // Exibir resultados da pesquisa
                elements.radiosContainer.innerHTML = '';

                // Mostrar resultados de rádios
                if (result.radios?.length > 0) {
                    const section = document.createElement('div');
                    section.className = 'search-results-section';
                    section.innerHTML = '<h2>Rádios</h2>';
                    elements.radiosContainer.appendChild(section);
                    this.displayRadios(result.radios);
                }

                // Mostrar resultados de playlists
                if (result.playlists?.length > 0) {
                    const section = document.createElement('div');
                    section.className = 'search-results-section';
                    section.innerHTML = '<h2>Playlists</h2>';
                    elements.radiosContainer.appendChild(section);

                    const dummyRadio = {
                        id: 'search-results',
                        nome: 'Resultados da Pesquisa',
                        capaUrl: config.defaultCover
                    };

                    this.displayPlaylists(dummyRadio, result.playlists);
                }

                // Mostrar resultados de músicas
                if (result.musicas?.length > 0) {
                    const section = document.createElement('div');
                    section.className = 'search-results-section';
                    section.innerHTML = '<h2>Músicas</h2>';
                    elements.radiosContainer.appendChild(section);

                    result.musicas.forEach(musica => {
                        const card = document.createElement('div');
                        card.className = 'card';
                        card.innerHTML = `
                            <div class="cover-container">
                                <div class="cover-image" style="background-image: url('${musica.capaUrl || config.defaultCover}')"></div>
                                <div class="play-overlay">
                                    <i class="fas fa-play"></i>
                                </div>
                            </div>
                            <div class="card-info">
                                <div class="card-title">${musica.titulo}</div>
                                <div class="card-subtitle">${musica.artista}</div>
                                <div class="card-duration">${utils.formatDuration(musica.duracaoSegundos)}</div>
                            </div>
                        `;

                        card.addEventListener('click', () => {
                            playerState.currentRadio = {
                                id: 'search-result',
                                nome: 'Resultado da Busca',
                                capaUrl: config.defaultCover
                            };
                            playerState.playlist = result.musicas;
                            const index = result.musicas.findIndex(m => m.id === musica.id);
                            this.playMusic(index);
                        });

                        elements.radiosContainer.appendChild(card);
                    });
                }

                // Se nenhum resultado encontrado
                if ((!result.radios || result.radios.length === 0) &&
                    (!result.playlists || result.playlists.length === 0) &&
                    (!result.musicas || result.musicas.length === 0)) {
                    elements.error.textContent = 'Nenhum resultado encontrado.';
                    elements.error.style.display = 'block';
                }

            } catch (error) {
                utils.handleError(elements.error, `Erro na pesquisa: ${error.message}`);
            } finally {
                utils.hideLoading();
            }
        },

        clearSearch: function () {
            if (elements.searchInput) elements.searchInput.value = '';
            this.loadRadios();
        },

        playMusic: async function (index) {
            if (index < 0 || index >= playerState.playlist.length) return;

            try {
                playerState.resetPlayer();

                playerState.currentIndex = index;
                playerState.currentMusic = playerState.playlist[index];

                // Atualizar UI
                if (elements.nowPlayingTitle) elements.nowPlayingTitle.textContent = playerState.currentMusic.titulo;
                if (elements.nowPlayingArtist) elements.nowPlayingArtist.textContent = playerState.currentMusic.artista;
                if (elements.nowPlaying) elements.nowPlaying.style.display = 'flex';
                if (elements.playPauseBtn) elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

                const coverUrl = playerState.currentMusic.capaUrl ||
                    (playerState.currentRadio ? playerState.currentRadio.capaUrl : config.defaultCover);
                if (elements.nowPlayingCover) {
                    elements.nowPlayingCover.style.backgroundImage = `url('${coverUrl}')`;
                }

                // Configurar áudio
                playerState.audioPlayer.src = playerState.currentMusic.urlStream;
                if (elements.volumeSlider) {
                    playerState.audioPlayer.volume = elements.volumeSlider.value;
                }

                // Configurar eventos do player
                playerState.audioPlayer.onended = () => this.playNext();
                playerState.audioPlayer.onplay = () => this.updatePlayerProgress();

                // Esperar até que o áudio esteja pronto
                await new Promise((resolve) => {
                    playerState.audioPlayer.oncanplay = () => {
                        playerState.audioPlayer.oncanplay = null;
                        resolve();
                    };
                    playerState.audioPlayer.load();
                });

                // Tentar reproduzir
                try {
                    await playerState.audioPlayer.play();
                    playerState.isPlaying = true;
                } catch (err) {
                    console.error("Erro ao tocar:", err);
                    // Segunda tentativa após pequeno delay
                    setTimeout(async () => {
                        try {
                            await playerState.audioPlayer.play();
                            playerState.isPlaying = true;
                        } catch (err2) {
                            utils.handleError(elements.error, "Erro ao reproduzir o áudio");
                            playerState.isPlaying = false;
                        }
                    }, 200);
                }

            } catch (error) {
                console.error("Erro no playMusic:", error);
                utils.handleError(elements.error, `Erro: ${error.message}`);
                playerState.isPlaying = false;
            }
        },

        togglePlayPause: async function () {
            if (!playerState.currentMusic) return;

            try {
                if (playerState.isPlaying) {
                    await playerState.audioPlayer.pause();
                } else {
                    await playerState.audioPlayer.play();
                }
                playerState.isPlaying = !playerState.isPlaying;
                if (elements.playPauseBtn) {
                    elements.playPauseBtn.innerHTML = playerState.isPlaying
                        ? '<i class="fas fa-pause"></i>'
                        : '<i class="fas fa-play"></i>';
                }
            } catch (error) {
                console.error("Playback error:", error);
            }
        },

        playNext: function () {
            if (playerState.playlist.length === 0) return;

            let newIndex = playerState.currentIndex + 1;
            if (newIndex >= playerState.playlist.length) newIndex = 0;
            this.playMusic(newIndex);
        },

        playPrevious: function () {
            if (playerState.playlist.length === 0) return;

            let newIndex = playerState.currentIndex - 1;
            if (newIndex < 0) newIndex = playerState.playlist.length - 1;
            this.playMusic(newIndex);
        },

        updatePlayerProgress: function () {
            clearInterval(playerState.progressInterval);

            const update = () => {
                if (!playerState.audioPlayer.duration || isNaN(playerState.audioPlayer.duration)) return;

                const progress = (playerState.audioPlayer.currentTime / playerState.audioPlayer.duration) * 100;
                if (elements.progressBar) elements.progressBar.style.width = `${progress}%`;
                if (elements.currentTime) elements.currentTime.textContent = utils.formatDuration(playerState.audioPlayer.currentTime);
                if (elements.duration) elements.duration.textContent = utils.formatDuration(playerState.audioPlayer.duration);
            };

            update();
            playerState.progressInterval = setInterval(update, 1000);
        },

        closeMusicModal: function () {
            if (elements.musicModal) {
                elements.musicModal.style.display = 'none';
            }
        },

        resetPlayer: function () {
            playerState.resetPlayer();
        }

    };
    window.app = app;

    // 8. Funções globais
    window.logout = function () {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    };

    // 9. Inicializar a aplicação
    app.init();
});