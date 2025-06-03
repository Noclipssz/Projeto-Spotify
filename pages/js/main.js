const elements = {
    volumeSlider: document.getElementById('volumeSlider'),
    volumeDown: document.getElementById('volumeDown'),
    volumeUp: document.getElementById('volumeUp'),
    nowPlayingTitle: document.getElementById('nowPlayingTitle'),
    nowPlayingArtist: document.getElementById('nowPlayingArtist'),
    searchInput: document.getElementById('searchInput'),
    genreSelect: document.getElementById('genreSelect'),
    searchButton: document.getElementById('searchButton'),
    radiosContainer: document.getElementById('radiosContainer'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    musicModal: document.getElementById('musicModal'),
    modalHeader: document.getElementById('modalHeader'),
    modalRadioName: document.getElementById('modalRadioName'),
    musicList: document.getElementById('musicList'),
    musicLoading: document.getElementById('musicLoading'),
    musicError: document.getElementById('musicError'),
    closeModal: document.getElementById('closeModal'),
    nowPlaying: document.getElementById('nowPlaying'),
    nowPlayingCover: document.getElementById('nowPlayingCover'),
    nowPlayingTitle: document.getElementById('nowPlayingTitle'),
    nowPlayingArtist: document.getElementById('nowPlayingArtist'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    clearSearch: document.getElementById('clearSearch'),
    progressBar: document.getElementById('progressBar'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration')
};

const playerState = {
    currentRadio: null,
    currentPlaylist: null,
    currentMusic: null,
    isPlaying: false,
    audioPlayer: new Audio(),
    playlist: [],
    currentIndex: -1,
    progressInterval: null,

    resetPlayer: function() {
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

const config = {
    apiBaseUrl: 'http://10.10.30.61:8080',
    defaultCover: 'https://via.placeholder.com/300/181818/282828?text=🎵'
};

const utils = {
    formatDuration: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    },

    handleError: (element, message) => {
        console.error(message);
        element.textContent = message;
        element.style.display = 'block';
        elements.loading.style.display = 'none';
    }
};

const app = {
    init: () => {
        app.setupEventListeners();
        app.loadPlaylists();
        app.checkTextOverflow();
    },

    setupEventListeners: () => {

        // Controles do modal
        if (elements.closeModal) {
            elements.closeModal.addEventListener('click', app.closeMusicModal);
        } else {
            console.error("Elemento closeModal não encontrado");
        }

        window.addEventListener('click', (e) => {
            if (e.target === elements.musicModal) {
                app.closeMusicModal();
            }
        });

        // Controles do player
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', app.togglePlayPause);
        }
        if (elements.nextBtn) {
            elements.nextBtn.addEventListener('click', app.playNext);
        }
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener('click', app.playPrevious);
        }

        // Barra de progresso
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                if (!playerState.audioPlayer.duration) return;

                const progressBar = e.currentTarget;
                const clickPosition = e.clientX - progressBar.getBoundingClientRect().left;
                const percentClicked = (clickPosition / progressBar.clientWidth);
                playerState.audioPlayer.currentTime = percentClicked * playerState.audioPlayer.duration;
            });
        }

        // Pesquisa e filtros
        if (elements.searchButton) {
            elements.searchButton.addEventListener('click', app.performSearch);
        }
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') app.performSearch();
            });
        }
        if (elements.clearSearch) {
            elements.clearSearch.addEventListener('click', app.clearSearch);
        }
        if (elements.genreSelect) {
            elements.genreSelect.addEventListener('change', app.applyFilters);
        }

        elements.volumeSlider.addEventListener('input', (e) => {
        playerState.audioPlayer.volume = e.target.value;
        });
        
        elements.volumeDown.addEventListener('click', () => {
            playerState.audioPlayer.volume = Math.max(0, playerState.audioPlayer.volume - 0.1);
            elements.volumeSlider.value = playerState.audioPlayer.volume;
        });
        
        elements.volumeUp.addEventListener('click', () => {
            playerState.audioPlayer.volume = Math.min(1, playerState.audioPlayer.volume + 0.1);
            elements.volumeSlider.value = playerState.audioPlayer.volume;
        });
        
    },
        checkTextOverflow: () => {
        const check = () => {
            ['nowPlayingTitle', 'nowPlayingArtist'].forEach(id => {
                const element = document.getElementById(id);
                if (element.scrollWidth > element.offsetWidth) {
                    element.classList.add('marquee');
                } else {
                    element.classList.remove('marquee');
                }
            });
        };
        
        // Verifica a cada 500ms e sempre que uma nova música tocar
        setInterval(check, 500);
    },performSearch: async () => {
    const term = elements.searchInput.value.trim();
    
    if (!term) {
        await app.loadPlaylists();
        return;
    }

    elements.loading.style.display = 'block';
    elements.error.style.display = 'none';
    elements.radiosContainer.innerHTML = '';

    try {
        const response = await fetch(`${config.apiBaseUrl}/api/search?termo=${encodeURIComponent(term)}`);
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        
        const result = await response.json();
        
        // Limpa o container
        elements.radiosContainer.innerHTML = '';
        
        // Mostra resultados de rádios (se existirem)
        if (result.radios && result.radios.length > 0) {
            const section = document.createElement('div');
            section.className = 'search-results-section';
            section.innerHTML = '<h2>Rádios</h2>';
            elements.radiosContainer.appendChild(section);
            app.displayRadios(result.radios);
        }
        
        // Mostra resultados de playlists (se existirem)
        if (result.playlists && result.playlists.length > 0) {
            const section = document.createElement('div');
            section.className = 'search-results-section';
            section.innerHTML = '<h2>Playlists</h2>';
            elements.radiosContainer.appendChild(section);
            
            // Cria um objeto de rádio fictício para a pesquisa
            const dummyRadio = {
                id: 'search-results',
                nome: 'Resultados da Pesquisa',
                capaUrl: config.defaultCover
            };
            
            app.displayPlaylists(dummyRadio, result.playlists);
        }
        
        // Mostra resultados de músicas (se existirem)
        if (result.musicas && result.musicas.length > 0) {
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
                    app.playMusic(index);
                });
                
                elements.radiosContainer.appendChild(card);
            });
        }
        
        // Verifica se não encontrou nada
        if ((!result.radios || result.radios.length === 0) &&
            (!result.playlists || result.playlists.length === 0) &&
            (!result.musicas || result.musicas.length === 0)) {
            elements.error.textContent = 'Nenhum resultado encontrado.';
            elements.error.style.display = 'block';
        }
        
    } catch (error) {
        utils.handleError(elements.error, `Erro na pesquisa: ${error.message}`);
    } finally {
        elements.loading.style.display = 'none';
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

displayPlaylists: (radio, playlists) => {
        elements.radiosContainer.innerHTML = `
            <div class="breadcrumb">
                <span onclick="app.loadPlaylists()">Rádios</span> > ${radio.nome}
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
            
            card.addEventListener('click', () => app.openPlaylistMusicas(radio, playlist));
            elements.radiosContainer.appendChild(card);
        });
    },
        openPlaylistMusicas: async (radio, playlist) => {
        playerState.currentRadio = radio;
        playerState.currentPlaylist = playlist;
        
        elements.musicModal.style.display = 'block';
        elements.modalHeader.style.backgroundImage = `url('${playlist.capaUrl || radio.capaUrl || config.defaultCover}')`;
        elements.modalRadioName.textContent = `${radio.nome} - ${playlist.nome}`;
        
        try {
            elements.musicLoading.style.display = 'block';
            const response = await fetch(`${config.apiBaseUrl}/api/radios/${radio.id}/playlists/${playlist.id}/musicas`);
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            
            const musicas = await response.json();
            playerState.playlist = musicas;
            app.displayMusicas(musicas);
        } catch (error) {
            utils.handleError(elements.musicError, `Erro ao carregar músicas: ${error.message}`);
        } finally {
            elements.musicLoading.style.display = 'none';
        }
    },

    openPlaylist: async (playlist) => {
        try {
            elements.loading.style.display = 'block';
            const response = await fetch(`${config.apiBaseUrl}/api/radios/${playlist.id}/playlists`);
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            
            const subPlaylists = await response.json();
            app.displaySubPlaylists(playlist, subPlaylists);
        } catch (error) {
            utils.handleError(elements.error, `Erro ao carregar sub-playlists: ${error.message}`);
        } finally {
            elements.loading.style.display = 'none';
        }
    },

    displaySubPlaylists: (parentPlaylist, subPlaylists) => {
        elements.radiosContainer.innerHTML = `
            <div class="breadcrumb">
                <span onclick="app.loadPlaylists()">Playlists</span> > ${parentPlaylist.nome}
            </div>
        `;
        
        subPlaylists.forEach(subPlaylist => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="cover-container">
                    <div class="cover-image" style="background-image: url('${subPlaylist.capaUrl || parentPlaylist.capaUrl || config.defaultCover}')"></div>
                </div>
                <div class="card-info">
                    <div class="card-title">${subPlaylist.nome}</div>
                    <div class="card-subtitle">${subPlaylist.descricao || 'Sub-playlist'}</div>
                </div>
            `;
            
            card.addEventListener('click', () => app.openRadio(subPlaylist));
            elements.radiosContainer.appendChild(card);
        });
    },

     openRadioPlaylists: async (radio) => {
        try {
            elements.loading.style.display = 'block';
            const response = await fetch(`${config.apiBaseUrl}/api/radios/${radio.id}/playlists`);
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            
            const playlists = await response.json();
            app.displayPlaylists(radio, playlists);
        } catch (error) {
            utils.handleError(elements.error, `Erro ao carregar playlists: ${error.message}`);
        } finally {
            elements.loading.style.display = 'none';
        }
    },

    openRadio: async (radio) => {
        playerState.currentRadio = radio;
        elements.musicModal.style.display = 'block';
        elements.modalHeader.style.backgroundImage = `url('${radio.capaUrl || config.defaultCover}')`;
        elements.modalRadioName.textContent = radio.nome;
        
        try {
            elements.musicLoading.style.display = 'block';
            const response = await fetch(`${config.apiBaseUrl}/api/radios/${radio.id}/musicas`);
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            
            const musicas = await response.json();
            playerState.playlist = musicas;
            app.displayMusicas(musicas);
        } catch (error) {
            utils.handleError(elements.musicError, `Erro ao carregar músicas: ${error.message}`);
        } finally {
            elements.musicLoading.style.display = 'none';
        }
    },

    displayMusicas: (musicas) => {
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
            
            card.addEventListener('click', () => app.playMusic(index));

            elements.musicList.appendChild(card);
        });
    },

    playMusic: async (index) => {

    if (index < 0 || index >= playerState.playlist.length) return;

    try {
        // Reseta completamente o player antes de começar
        playerState.resetPlayer();
        
        playerState.currentIndex = index;
        playerState.currentMusic = playerState.playlist[index];
        
        // Atualiza a UI primeiro
        elements.nowPlayingTitle.textContent = playerState.currentMusic.titulo;
        elements.nowPlayingArtist.textContent = playerState.currentMusic.artista;
        elements.nowPlaying.style.display = 'flex';
        elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

        
        const coverUrl = playerState.currentMusic.capaUrl || 
                        playerState.currentRadio.capaUrl || 
                        config.defaultCover;
        elements.nowPlayingCover.style.backgroundImage = `url('${coverUrl}')`;

        // Configura o áudio com tratamento especial
        playerState.audioPlayer.src = playerState.currentMusic.urlStream;
        
        // Remove listeners antigos
        playerState.audioPlayer.onended = null;
        playerState.audioPlayer.onplay = null;
        playerState.audioPlayer.oncanplay = null;
                // Atualiza o texto e verifica overflow
        elements.nowPlayingTitle.textContent = playerState.currentMusic.titulo;
        elements.nowPlayingArtist.textContent = playerState.currentMusic.artista;
        setTimeout(app.checkTextOverflow, 100);
        
        // Configura volume inicial
        playerState.audioPlayer.volume = elements.volumeSlider.value;
        
        // Adiciona novos listeners
        playerState.audioPlayer.onended = () => app.playNext();
        playerState.audioPlayer.onplay = () => app.updatePlayerProgress();
        
        // Espera até que o áudio esteja pronto para tocar
        await new Promise((resolve) => {
            playerState.audioPlayer.oncanplay = () => {
                playerState.audioPlayer.oncanplay = null;
                resolve();
            };
            playerState.audioPlayer.load();
        });

        // Toca o áudio com tratamento de erro
        try {
            await playerState.audioPlayer.play();
            playerState.isPlaying = true;
        } catch (err) {
            console.error("Erro ao tocar:", err);
            // Tenta novamente após pequeno delay
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
togglePlayPause: async () => {
    if (!playerState.currentMusic) return;
    
    try {
        if (playerState.isPlaying) {
            await playerState.audioPlayer.pause();
        } else {
            await playerState.audioPlayer.play();
        }
        playerState.isPlaying = !playerState.isPlaying;
        elements.playPauseBtn.innerHTML = playerState.isPlaying 
            ? '<i class="fas fa-pause"></i>' 
            : '<i class="fas fa-play"></i>';
    } catch (error) {
        console.error("Playback error:", error);
    }
},

    playNext: () => {
        if (playerState.playlist.length === 0) return;

        let newIndex = playerState.currentIndex + 1;
        if (newIndex >= playerState.playlist.length) newIndex = 0;
        app.playMusic(newIndex);
    },

    playPrevious: () => {
        if (playerState.playlist.length === 0) return;

        let newIndex = playerState.currentIndex - 1;
        if (newIndex < 0) newIndex = playerState.playlist.length - 1;
        app.playMusic(newIndex);
    },

updatePlayerProgress: () => {
    clearInterval(playerState.progressInterval);
    
    // Atualiza imediatamente
    const update = () => {
        if (!playerState.audioPlayer.duration || isNaN(playerState.audioPlayer.duration)) return;
        
        const progress = (playerState.audioPlayer.currentTime / playerState.audioPlayer.duration) * 100;
        elements.progressBar.style.width = `${progress}%`;
        elements.currentTime.textContent = utils.formatDuration(playerState.audioPlayer.currentTime);
        elements.duration.textContent = utils.formatDuration(playerState.audioPlayer.duration);
    };
    
    update();
    
    // Configura intervalo
    playerState.progressInterval = setInterval(update, 1000);
},
displayRadios: (radios) => {
        elements.radiosContainer.innerHTML = '';
        radios.forEach(radio => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="cover-container">
                    <div class="cover-image" style="background-image: url('${radio.capaUrl || config.defaultCover}')"></div>
                </div>
                <div class="card-info">
                    <div class="card-title">${radio.nome}</div>
                </div>
            `;
            
            card.addEventListener('click', () => app.openRadioPlaylists(radio));
            elements.radiosContainer.appendChild(card);
        });
    },

    updateTimeDisplay: () => {
        if (!playerState.audioPlayer.duration) return;

        const progress = (playerState.audioPlayer.currentTime / playerState.audioPlayer.duration) * 100;
        elements.progressBar.style.width = `${progress}%`;
        elements.currentTime.textContent = utils.formatDuration(playerState.audioPlayer.currentTime);
        elements.duration.textContent = utils.formatDuration(playerState.audioPlayer.duration);
    },

    closeMusicModal: () => {
        if (elements.musicModal) {
            elements.musicModal.style.display = 'none';
        }
    },

    clearSearch: () => {
        elements.searchInput.value = '';
        elements.genreSelect.value = '';
        app.loadRadios();
    },

    applyFilters: async () => {
        const searchTerm = elements.searchInput.value.trim();
        const genre = elements.genreSelect.value;

        if (!searchTerm && !genre) {
            app.loadRadios();
            return;
        }

        elements.loading.style.display = 'block';
        elements.error.style.display = 'none';
        elements.radiosContainer.innerHTML = '';

        try {
            let url = `${config.apiBaseUrl}/api/pesquisa?`;
            if (searchTerm) url += `termo=${encodeURIComponent(searchTerm)}&`;
            if (genre) url += `genero=${genre}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);

            const result = await response.json();
            elements.radiosContainer.innerHTML = '';

            // Mostra rádios encontradas
            if (result.radios?.length > 0) {
                const section = document.createElement('div');
                section.className = 'search-results-section';
                section.innerHTML = '<h2 class="search-section-title">Rádios</h2>';
                elements.radiosContainer.appendChild(section);
                app.displayRadios(result.radios);
            }

            // Mostra músicas encontradas
            if (result.musicas?.length > 0) {
                const section = document.createElement('div');
                section.className = 'search-results-section';
                section.innerHTML = '<h2 class="search-section-title">Músicas</h2>';
                elements.radiosContainer.appendChild(section);

                result.musicas.forEach(music => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const coverUrl = music.capaUrl || config.defaultCover;

                    card.innerHTML = `
                        <div class="cover-container">
                            <div class="cover-image" style="background-image: url('${coverUrl}')"></div>
                            <div class="play-overlay">
                                <div class="play-icon">
                                    <i class="fas fa-play"></i>
                                </div>
                            </div>
                        </div>
                        <div class="card-info">
                            <div class="card-title">${music.titulo}</div>
                            <div class="card-subtitle">${music.artista}</div>
                            <div class="card-duration">${utils.formatDuration(music.duracaoSegundos)}</div>
                        </div>
                    `;

                    card.addEventListener('click', async () => {
                        try {
                            elements.loading.style.display = 'block';

                            // Carrega a rádio da música
                            const radioResponse = await fetch(`${config.apiBaseUrl}/radios/${music.radioId}`);
                            if (!radioResponse.ok) throw new Error(`Erro ao buscar rádio: ${radioResponse.status}`);
                            const radio = await radioResponse.json();

                            // Carrega as músicas da rádio
                            const musicResponse = await fetch(`${config.apiBaseUrl}/radios/${radio.id}/musicas`);
                            if (!musicResponse.ok) throw new Error(`Erro ao buscar músicas: ${musicResponse.status}`);
                            const musicas = await musicResponse.json();

                            // Encontra e toca a música
                            const index = musicas.findIndex(m => m.id === music.id);
                            if (index === -1) throw new Error('Música não encontrada na playlist');

                            playerState.currentRadio = radio;
                            playerState.playlist = musicas;
                            app.playMusic(index);
                        } catch (error) {
                            console.error("Erro ao tocar música:", error);
                            utils.handleError(elements.error, `Erro: ${error.message}`);
                        } finally {
                            elements.loading.style.display = 'none';
                        }
                    });

                    elements.radiosContainer.appendChild(card);
                });
            }

            if ((!result.radios || result.radios.length === 0) &&
                (!result.musicas || result.musicas.length === 0)) {
                elements.error.textContent = 'Nenhum resultado encontrado.';
                elements.error.style.display = 'block';
            }
        } catch (error) {
            console.error("Erro na pesquisa:", error);
            utils.handleError(elements.error, `Erro na pesquisa: ${error.message}`);
        } finally {
            elements.loading.style.display = 'none';
        }
    }

};

document.addEventListener('DOMContentLoaded', app.init);