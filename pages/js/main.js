let app;
// main.js - Versão completa integrada
document.addEventListener('DOMContentLoaded', function () {
    // 1. Configurações iniciais
    const config = {
        apiBaseUrl: 'https://spotify-production-c34a.up.railway.app',
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
        favorites: document.querySelector('.favorites'),

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

    // 4. Estado da aplicação
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

    // 5. Funções utilitárias
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

    // 6. Funções da API
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

                if (!Array.isArray(songs) || songs.length === 0) {
                    throw new Error('Playlist vazia');
                }

                return songs;
            } catch (error) {
                console.error('Erro ao buscar músicas da playlist:', error);
                throw error;
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
        },

        addFavoritePlaylist: async (playlistId) => {
            const response = await api.request(
                `${config.apiBaseUrl}/api/usuario-playlist-favoritas/${userId}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playlistId })
                }
            );
            return response;
        },

        removeFavoritePlaylist: async (playlistId) => {
            const response = await api.request(
                `${config.apiBaseUrl}/api/usuario-playlist-favoritas/${userId}/${playlistId}`,
                { method: 'DELETE' }
            );
            return response;
        }
    };

    // Funções para gerenciar playlists favoritas
    async function loadFavoritePlaylists() {
        try {
            const response = await api.request(`${config.apiBaseUrl}/api/usuario-playlist-favoritas/${userId}`);
            return await response.json();
        } catch (error) {
            utils.handleError(elements.error, `Erro ao carregar favoritas: ${error.message}`);
            return [];
        }
    }

    function displayFavoritePlaylists(playlists) {
        if (!elements.favorites) return;
        
        elements.favorites.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'section-title';
        title.innerHTML = '<i class="fas fa-star"></i> <span>Playlists Favoritas</span>';
        elements.favorites.appendChild(title);

        if (!playlists || playlists.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-playlist-message';
            emptyMsg.textContent = 'Nenhuma playlist favoritada';
            elements.favorites.appendChild(emptyMsg);
            return;
        }

        playlists.forEach(playlist => {
            const playlistElement = document.createElement('div');
            playlistElement.className = 'sidebar-playlist';
            playlistElement.dataset.id = playlist.playlistId;
            playlistElement.innerHTML = `
                <div class="playlist-cover" 
                     style="background-image: url('${playlist.capaUrl || config.defaultCover}')">
                    <div class="favorite-star active">
                        <i class="fas fa-star"></i>
                    </div>
                </div>
                <div class="playlist-info">
                    <div class="playlist-name">${playlist.nome}</div>
                    <div class="playlist-description">${playlist.descricao || 'Playlist'}</div>
                </div>
            `;

            playlistElement.addEventListener('click', () => {
                openPlaylistModal(playlist);
            });

            elements.favorites.appendChild(playlistElement);
        });
    }

    async function openPlaylistModal(playlist) {
        elements.musicList.innerHTML = '';
        elements.musicError.style.display = 'none';
        elements.musicLoading.style.display = 'block';
        
        playerState.currentPlaylist = playlist;
        elements.modalHeader.style.backgroundImage = `url('${playlist.capaUrl || config.defaultCover}')`;
        elements.modalRadioName.textContent = playlist.nome;
        elements.musicModal.style.display = 'block';
        
        await addFavoriteButtonToModal(playlist);
        loadPlaylistMusics(playlist.playlistId);
    }

    async function addFavoriteButtonToModal(playlist) {
        const modalHeader = document.querySelector('.modal-header');
        
        const existingBtn = document.querySelector('.favorite-btn-modal');
        if (existingBtn) existingBtn.remove();
        
        const favButton = document.createElement('button');
        favButton.className = 'favorite-btn-modal';
        favButton.innerHTML = `<i class="fas fa-star"></i>`;
        
        const isFavorite = await checkIfPlaylistIsFavorite(playlist.playlistId);
        
        if (isFavorite) {
            favButton.classList.add('active');
            favButton.title = 'Remover dos favoritos';
        } else {
            favButton.title = 'Adicionar aos favoritos';
        }
        
        favButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleFavoritePlaylist(playlist, favButton);
        });
        
        modalHeader.appendChild(favButton);
    }

    async function checkIfPlaylistIsFavorite(playlistId) {
        try {
            const favoritePlaylists = await loadFavoritePlaylists();
            return favoritePlaylists.some(playlist => playlist.playlistId === playlistId);
        } catch (error) {
            console.error('Erro ao verificar favoritos:', error);
            return false;
        }
    }

    async function toggleFavoritePlaylist(playlist, buttonElement) {
        try {
            const isFavorite = buttonElement.classList.contains('active');
            let response;
            
            if (isFavorite) {
                response = await api.removeFavoritePlaylist(playlist.playlistId);
            } else {
                response = await api.addFavoritePlaylist(playlist.playlistId);
            }

            if (response.ok) {
                buttonElement.classList.toggle('active');
                buttonElement.title = isFavorite ? 'Adicionar aos favoritos' : 'Remover dos favoritos';
                
                const playlists = await loadFavoritePlaylists();
                displayFavoritePlaylists(playlists);
            } else {
                throw new Error('Falha na operação');
            }
        } catch (error) {
            console.error('Erro ao favoritar/desfavoritar:', error);
            utils.handleError(elements.error, 'Erro ao atualizar favoritos');
        }
    }

    async function loadPlaylistMusics(playlistId) {
        try {
            elements.musicLoading.style.display = 'block';
            elements.musicError.style.display = 'none';
            elements.musicList.innerHTML = '';

            const songs = await api.getPlaylistSongs(playlistId);
            playerState.playlist = songs;
            displayMusicas(songs);

        } catch (error) {
            let errorMessage = `Erro ao carregar músicas: ${error.message}`;

            if (error.message.includes('vazia')) {
                errorMessage = 'Esta playlist está vazia';
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
    }

    function displayMusicas(musicas) {
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

        musicas.forEach((musica, index) => {
            const card = document.createElement('div');
            card.className = 'music';
            card.innerHTML = `
                <div class="music-container">
                    <div class="music-image" style="background-image: url('${musica.capaUrl || playerState.currentPlaylist?.capaUrl || config.defaultCover}')"></div>
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
                app.playMusic(index);
            });

            elements.musicList.appendChild(card);
        });
    }

    function closeMusicModal() {
        elements.musicModal.style.display = 'none';
        elements.musicList.innerHTML = '';
        elements.modalHeader.style.backgroundImage = '';
        elements.modalRadioName.textContent = '';
        playerState.currentPlaylist = null;
    }

    // 7. Aplicação principal
    const app = {
        init: function () {
            if (elements.welcomeMessage) {
                elements.welcomeMessage.textContent = `Bem-vindo, ${userName}`;
            }

            this.setupEventListeners();
            utils.checkTextOverflow();
            this.loadInitialData();
        },

        setupEventListeners: function () {
            document.querySelector('.logo-container')?.addEventListener('click', () => this.loadPlaylists());
            document.querySelector('.menu-item')?.addEventListener('click', () => this.loadPlaylists());
            
            document.querySelectorAll('.breadcrumb span').forEach(el => {
                el.addEventListener('click', () => this.loadRadios());
            });

            document.querySelectorAll('.empty-playlist-message button').forEach(el => {
                el.addEventListener('click', () => this.loadPlaylists());
            });

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

            if (elements.playPauseBtn) {
                elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
            }

            if (elements.nextBtn) {
                elements.nextBtn.addEventListener('click', () => this.playNext());
            }

            if (elements.prevBtn) {
                elements.prevBtn.addEventListener('click', () => this.playPrevious());
            }

            if (elements.closeModal) {
                elements.closeModal.addEventListener('click', () => closeMusicModal());
            }

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
                const [playlists, favorites] = await Promise.all([
                    api.getUserPlaylists(),
                    api.getFavoritePlaylists()
                ]);

                playerState.userPlaylists = playlists;
                playerState.favoritePlaylists = favorites;

                this.displayUserPlaylists();
                displayFavoritePlaylists(favorites);
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

            const favoritesItem = document.createElement('div');
            favoritesItem.className = 'playlist favorites';
            favoritesItem.innerHTML = `
                <div class="playlist-title">Músicas Curtidas</div>
                <div class="playlist-info">Playlist</div>
            `;
            favoritesItem.addEventListener('click', () => this.loadFavoriteSongs());
            elements.userPlaylists.appendChild(favoritesItem);

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
                }

                const favoriteRadio = {
                    id: 'favorites',
                    nome: 'Músicas Curtidas',
                    capaUrl: config.defaultCover
                };

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
                displayMusicas(songs);

            } catch (error) {
                let errorMessage = `Erro ao carregar músicas: ${error.message}`;

                if (error.message.includes('vazia')) {
                    errorMessage = 'Esta playlist está vazia';
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

        loadPlaylists: async function () {
            try {
                elements.loading.style.display = 'block';
                const response = await fetch(`${config.apiBaseUrl}/api/radios`);
                if (!response.ok) throw new Error(`Erro ${response.status}`);
                
                const radios = await response.json();
                this.displayRadios(radios);
            } catch (error) {
                utils.handleError(elements.error, `Erro ao carregar rádios: ${error.message}`);
            } finally {
                elements.loading.style.display = 'none';
            }
        },

// Substituir a função loadRadios por:
loadRadios: async function () {
    utils.showLoading();
    elements.radiosContainer.innerHTML = '';

    try {
        const response = await api.request(`${config.apiBaseUrl}/api/radios/grouped`);
        if (!response.ok) throw new Error('Erro ao carregar rádios');
        
        const groupedRadios = await response.json();
        this.displayGroupedRadios(groupedRadios);

    } catch (error) {
        utils.handleError(elements.error, `Erro ao carregar rádios: ${error.message}`);
    } finally {
        utils.hideLoading();
    }
},

displayGroupedRadios: function(groupedRadios) {
    elements.radiosContainer.innerHTML = '';

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'radio-groups-container';

    for (const [groupName, radios] of Object.entries(groupedRadios)) {
        if (radios.length === 0) continue;

        const groupSection = document.createElement('div');
        groupSection.className = 'radio-group';
        groupSection.innerHTML = `
            <h2 class="group-title">${this.formatGroupName(groupName)}</h2>
            <div class="group-radios" id="group-${groupName}"></div>
        `;

        const radiosContainer = groupSection.querySelector(`.group-radios`);
        
        radios.forEach(radio => {
            const card = this.createRadioCard(radio);
            radiosContainer.appendChild(card);
        });

        groupsContainer.appendChild(groupSection);
    }

    elements.radiosContainer.appendChild(groupsContainer);
},

formatGroupName: function(name) {
    const names = {
        'corrida': 'Jogos de Corrida',
        'esporte': 'Jogos de Esporte',
        'rpg': 'RPGs',
        'fps': 'FPS',
        'simulacao': 'Simulação',
        'musica': 'Jogos de Música',
        'acao': 'Ação/Aventura'
    };
    return names[name] || name;
},

createRadioCard: function(radio) {
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
            ${radio.playlists?.length > 0 ? 
              `<div class="card-subtitle">${radio.playlists.length} playlists</div>` : 
              '<div class="card-subtitle">Rádio</div>'}
        </div>
    `;

    card.addEventListener('click', () => {
        if (radio.playlists?.length > 0) {
            this.openRadioPlaylists(radio);
        } else {
            // Se não tem playlists, tratar como playlist única
            this.openPlaylistMusicas(radio, {
                id: radio.id,
                nome: radio.nome,
                descricao: `Músicas de ${radio.nome}`,
                capaUrl: radio.capaUrl
            });
        }
    });

    return card;
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
        card.dataset.playlistId = playlist.id;
        
        // Criar elemento de estrela de favoritos
        const favoriteStar = document.createElement('div');
        favoriteStar.className = 'favorite-star';
        favoriteStar.innerHTML = '<i class="far fa-star"></i>';
        
        // Verificar se a playlist é favorita
        this.checkIfPlaylistIsFavorite(playlist.id).then(isFavorite => {
            if (isFavorite) {
                favoriteStar.innerHTML = '<i class="fas fa-star"></i>';
                favoriteStar.classList.add('active');
            }
        });

        // Adicionar evento de clique para favoritar/desfavoritar
        favoriteStar.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const isFavorite = favoriteStar.classList.contains('active');
                
                let response;
                if (isFavorite) {
                    response = await api.removeFavoritePlaylist(playlist.id);
                } else {
                    response = await api.addFavoritePlaylist(playlist.id);
                }

                if (response.ok) {
                    favoriteStar.classList.toggle('active');
                    favoriteStar.innerHTML = isFavorite 
                        ? '<i class="far fa-star"></i>' 
                        : '<i class="fas fa-star"></i>';
                    
                    // Atualizar a lista de favoritos na sidebar
                    const favorites = await loadFavoritePlaylists();
                    displayFavoritePlaylists(favorites);
                } else {
                    throw new Error('Falha na operação');
                }
            } catch (error) {
                console.error('Erro ao favoritar/desfavoritar:', error);
                utils.handleError(elements.error, 'Erro ao atualizar favoritos');
            }
        });

        card.innerHTML = `
            <div class="cover-container">
                <div class="cover-image" style="background-image: url('${playlist.capaUrl || radio.capaUrl || config.defaultCover}')"></div>
            </div>
            <div class="card-info">
                <div class="card-title">${playlist.nome}</div>
                <div class="card-subtitle">${playlist.descricao || 'Playlist de músicas'}</div>
            </div>
        `;
        
        // Adicionar a estrela ao card
        card.querySelector('.cover-container').appendChild(favoriteStar);

        card.addEventListener('click', () => {
            this.openPlaylistMusicas(radio, playlist);
        });

        elements.radiosContainer.appendChild(card);
    });
},

// Função auxiliar para verificar se uma playlist é favorita
checkIfPlaylistIsFavorite: async function(playlistId) {
    try {
        const response = await api.request(`${config.apiBaseUrl}/api/usuario-playlist-favoritas/${userId}`);
        if (!response.ok) return false;
        
        const favoritePlaylists = await response.json();
        return favoritePlaylists.some(playlist => playlist.playlistId === playlistId);
    } catch (error) {
        console.error('Erro ao verificar favoritos:', error);
        return false;
    }
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
                displayMusicas(musicas);
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

                elements.radiosContainer.innerHTML = '';

                if (result.radios?.length > 0) {
                    const section = document.createElement('div');
                    section.className = 'search-results-section';
                    section.innerHTML = '<h2>Rádios</h2>';
                    elements.radiosContainer.appendChild(section);
                    this.displayRadios(result.radios);
                }

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

                if (elements.nowPlayingTitle) elements.nowPlayingTitle.textContent = playerState.currentMusic.titulo;
                if (elements.nowPlayingArtist) elements.nowPlayingArtist.textContent = playerState.currentMusic.artista;
                if (elements.nowPlaying) elements.nowPlaying.style.display = 'flex';
                if (elements.playPauseBtn) elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

                const coverUrl = playerState.currentMusic.capaUrl ||
                    (playerState.currentRadio ? playerState.currentRadio.capaUrl : config.defaultCover);
                if (elements.nowPlayingCover) {
                    elements.nowPlayingCover.style.backgroundImage = `url('${coverUrl}')`;
                }

                playerState.audioPlayer.src = playerState.currentMusic.urlStream;
                if (elements.volumeSlider) {
                    playerState.audioPlayer.volume = elements.volumeSlider.value;
                }

                playerState.audioPlayer.onended = () => this.playNext();
                playerState.audioPlayer.onplay = () => this.updatePlayerProgress();

                await new Promise((resolve) => {
                    playerState.audioPlayer.oncanplay = () => {
                        playerState.audioPlayer.oncanplay = null;
                        resolve();
                    };
                    playerState.audioPlayer.load();
                });

                try {
                    await playerState.audioPlayer.play();
                    playerState.isPlaying = true;
                } catch (err) {
                    console.error("Erro ao tocar:", err);
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
            closeMusicModal();
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