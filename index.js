/*
 * ArtOfRP Launcher by XedonDEV & Kaibu
 *
 * Email Xedon: xedon@arctic-network.com
 * Web: https://github.com/XedonDev
 * Email Kaibu: NotKaibu@gmail.com
 * Web Kaibu: kaibu.me
 */

const {ipcRenderer} = require('electron')
const {clipboard} = require('electron')
const {shell} = require('electron') // eslint-disable-line
const humanizeDuration = require('humanize-duration')
const fs = require('fs')
const {dialog} = require('electron').remote
const {app} = require('electron').remote
const storage = require('electron-json-storage')
const Winreg = require('winreg')
const $ = window.jQuery = require('./resources/jquery/jquery-1.12.3.min.js')
const child = require('child_process')
var Chart = require('./node_modules/chart.js/dist/Chart.min')
const path = require('path')
const ping = require('ping')

/* global APIBaseURL APIModsURL alertify angular */

var App = angular.module('App', ['720kb.tooltips']).run(function ($rootScope) {
  $rootScope.downloading = false
  $rootScope.ArmaPath = ''
  $rootScope.slide = 0
  $rootScope.updating = false
  $rootScope.totalProgress = 0
  $rootScope.fileName = ''
  $rootScope.fileProgress = 0
  $rootScope.speed = 0

  $rootScope.closeApp = function () {
    ipcRenderer.send('close-app')
  }

  $rootScope.minimizeApp = function () {
    ipcRenderer.send('minimize-app')
  }

  $rootScope.refresh = function () {
    getMods()
    getServers()
    getNotification()
  }

  ipcRenderer.on('checking-for-update', function (event) {
    alertify.log('Suche nach Updates...', 'primary')
    $rootScope.updating = true
  })

  ipcRenderer.on('update-not-available', function (event) {
    alertify.log('Launcher ist aktuell', 'primary')
    $rootScope.updating = false
  })

  ipcRenderer.on('update-available', function (event) {
    spawnNotification('Update verfügbar, wird geladen...')
    alertify.log('Update verfügbar, wird geladen...', 'primary')
    $rootScope.updating = true
  })
})

App.controller('modController', ['$scope', '$rootScope', function ($scope, $rootScope) {
  $scope.getprofile = () => {
        $scope.loading = true
        getServers()
        getNotification()
        $scope.getProfiles()
    }

  $scope.state = 'Gestoppt'
  $scope.hint = 'Inaktiv'
  $rootScope.downloading = false
  $scope.totalSize = 0
  $scope.totalDownloaded = 0
  $scope.totalETA = ''
  $scope.fileProgress = ''

  $('#modScroll').perfectScrollbar({wheelSpeed: 0.5})

  ipcRenderer.on('to-app', function (event, args) {
    switch (args.type) {
      case 'mod-callback':
        $scope.mods = args.data.data
        $scope.loading = false
        $scope.checkUpdates()
        $scope.$apply()
        break
      case 'update-dl-progress-server':
        $scope.update({
          state: 'Download läuft',
          hint: '',
          downloading: true,
          downSpeed: toMB(args.state.speed),
          totalProgress: toFileProgress(args.state.totalSize, args.state.totalDownloaded + args.state.size.transferred),
          totalSize: toGB(args.state.totalSize),
          totalDownloaded: toGB(args.state.totalDownloaded + args.state.size.transferred),
          totalETA: humanizeDuration(Math.round(((args.state.totalSize - (args.state.totalDownloaded + args.state.size.transferred)) / args.state.speed) * 1000), {
            language: 'de',
            round: true
          }),
          fileName: args.state.fileName,
          fileProgress: toProgress(args.state.percent)
        })
        $scope.$apply()
        break
      case 'status-change':
        $scope.update({
          state: args.status,
          hint: args.hint,
          downloading: args.downloading,
          downSpeed: 0,
          totalProgress: '',
          totalSize: 0,
          totalDownloaded: 0,
          totalETA: '',
          fileName: '',
          fileProgress: ''
        })
        break
      case 'update-hash-progress':
        $scope.update({
          state: 'Dateien werden geprüft',
          hint: '5 - 10 Minuten',
          downloading: true,
          downSpeed: 0,
          totalProgress: toProgress(args.state.index / args.state.size),
          totalSize: 0,
          totalDownloaded: 0,
          totalETA: '',
          fileName: args.fileName,
          fileProgress: ''
        })
        break
      case 'update-hash-progress-done':
        $scope.update({
          state: 'Abgeschlossen',
          hint: '',
          downloading: false,
          downSpeed: 0,
          totalProgress: 100,
          totalSize: 0,
          totalDownloaded: 0,
          totalETA: '',
          fileName: '',
          fileProgress: ''
        })
        var size = 0
        for (var i = 0; i < args.list.length; i++) {
          size += args.list[i].Size
        }
        if (size !== 0) {
          $scope.initListDownload(args.list, args.mod)
          spawnNotification('Aktualisiere ' + args.list.length + ' Dateien (' + toGB(size) + ' GB)')
          $scope.$apply()
        } else {
          spawnNotification('Mod ist Aktuell.')
          $scope.reset()
        }
        break
      case 'update-dl-progress-done':
        $scope.state = 'Abgeschlossen'
        $scope.progress = 100
        spawnNotification('Download abgeschlossen.')
        $scope.reset()
        $scope.checkUpdates()
        break
      case 'cancelled':
        $scope.reset()
        break
      case 'update-quickcheck':
        for (var j = 0; j < $scope.mods.length; j++) {
          if ($scope.mods[j].Id === args.mod.Id) {
            if (args.update === 0) {
              $scope.mods[j].state = [1, 'Download']
            } else if (args.update === 1) {
              $scope.mods[j].state = [2, 'Update']
            } else {
              $scope.mods[j].state = [3, 'Spielen']
            }
          }
        }
        $scope.$apply()
        break
    }
  })

  $scope.reset = function () {
    $scope.update({
      state: 'Gestoppt',
      hint: '',
      downloading: false,
      downSpeed: 0,
      totalProgress: '',
      totalSize: 0,
      totalDownloaded: 0,
      totalETA: '',
      fileName: '',
      fileProgress: ''
    })
  }

  $scope.refresh = function () {
    getMods()
  }

  $scope.init = function () {
    $scope.loading = true
    try {
      fs.lstatSync(app.getPath('userData') + '\\settings.json')
      storage.get('settings', function (error, data) {
        if (error) throw error
        $rootScope.ArmaPath = data.armapath
        getMods()
      })
    } catch (e) {
      $scope.checkregkey1()
    }
  }

  $scope.initDownload = function (mod) {
    ipcRenderer.send('to-dwn', {
      type: 'start-mod-dwn',
      mod: mod,
      path: $rootScope.ArmaPath
    })
  }

  $scope.initHash = function (mod) {
    ipcRenderer.send('to-dwn', {
      type: 'start-mod-hash',
      mod: mod,
      path: $rootScope.ArmaPath
    })
  }

  $scope.initUpdate = function (mod) {
    ipcRenderer.send('to-dwn', {
      type: 'start-mod-update',
      mod: mod,
      path: $rootScope.ArmaPath
    })
  }

  $scope.initListDownload = function (list, mod) {
    $scope.update({
      state: 'Download startet',
      hint: '',
      downloading: true,
      downSpeed: 0,
      totalProgress: 0,
      totalSize: 0,
      totalDownloaded: 0,
      totalETA: '',
      fileName: '',
      fileProgress: ''
    })
    ipcRenderer.send('to-dwn', {
      type: 'start-list-dwn',
      list: list,
      mod: mod,
      path: $rootScope.ArmaPath
    })
  }

  $scope.cancel = function () {
    ipcRenderer.send('to-dwn', {
      type: 'cancel'
    })
  }


  $scope.update = function (update) {
    $scope.state = update.state
    $scope.hint = update.hint
    $rootScope.downloading = update.downloading
    $rootScope.speed = update.downSpeed
    $rootScope.totalProgress = update.totalProgress
    $scope.totalSize = update.totalSize
    $scope.totalDownloaded = update.totalDownloaded
    $scope.totalETA = update.totalETA
    $rootScope.fileName = update.fileName
    $rootScope.fileProgress = update.fileProgress
    $scope.$apply()
  }

  $scope.$watch(
    'totalProgress', function () {
      ipcRenderer.send('winprogress-change', {
        progress: $scope.totalProgress / 100
      })
    }, true)

    $scope.getProfiles = () => {
        $scope.profiles = {
            'available': []
        }

        storage.get('profile', (err, data) => {
            if (err) throw err

            $scope.profiles.selected = data.profile
    })

        let profileDir = app.getPath('documents') + '\\Arma 3 - Other Profiles'

        try {
            fs.lstatSync(profileDir).isDirectory()
            let profiles = fs.readdirSync(profileDir).filter(file => fs.statSync(path.join(profileDir, file)).isDirectory())
            profiles.forEach((profile, i) => {
                $scope.profiles.available.push(decodeURIComponent(profile))
        })
        } catch (e) {
            console.log(e)
            $scope.profiles = false
        }
    }

    $scope.setProfile = () => {
        storage.set('profile', {
            profile: $scope.profiles.selected
        }, (err) => {
            if (err) throw err
        })
    }

    $scope.action = function (mod) {
        switch (mod.state[0]) {
            case 1:
                $scope.initDownload(mod)
                break
            case 2:
                $scope.initUpdate(mod)
                break
            case 3:
                storage.get('settings', (err, data) => {

                    if (err) throw err

                    let params = []

                    params.push('-noLauncher')
                    params.push('-useBE')
                    params.push('-mod=' + mod.Directories)

                    if (mod.ExParams && typeof mod.ExParams !== 'undefined') {
                        params.extend(mod.ExParams.split(';'))
                    }
                    if (data.splash) {
                        params.push('-nosplash')
                    }
                    if (data.intro) {
                        params.push('-skipIntro')
                    }
                    if (data.ht) {
                        params.push('-enableHT')
                    }
                    if (data.windowed) {
                        params.push('-window')
                    }
                    if ($scope.profiles && typeof $scope.profiles.selected !== 'undefined') {
                    params.push('-name=' + $scope.profiles.selected)
                    }
                    if (data.mem && data.mem !== '' && typeof data.mem !== 'undefined') {
                        params.push('-maxMem=' + data.mem)
                    }
                    if (data.vram && data.vram !== '' && typeof data.vram !== 'undefined') {
                        params.push('-maxVRAM=' + data.vram)
                    }
                    if (data.cpu && data.cpu !== '' && typeof data.cpu !== 'undefined') {
                        params.push('-cpuCount=' + data.cpu)
                    }
                    if (data.thread && data.thread !== '' && typeof data.thread !== 'undefined') {
                        params.push('-exThreads=' + data.thread)
                    }
                    if (data.add_params && data.add_params !== '' && typeof data.add_params !== 'undefined') {
                        params.push(data.add_params)
                    }

                    spawnNotification('Arma wird gestartet...')
                    child.spawn((data.armapath + '\\arma3launcher.exe'), params, [])
                })
                break
            default:
                break
        }
    }

    $scope.openModDir = function (mod) {
        shell.showItemInFolder($rootScope.ArmaPath + '\\' + mod.Directories + '\\addons')
    }


  $scope.checkUpdates = function () {
    for (var i = 0; i < $scope.mods.length; i++) {
      if ($scope.mods[i].HasGameFiles) {
        if ($rootScope.ArmaPath !== '') {
          $scope.mods[i].state = [0, 'Wird überprüft']
          ipcRenderer.send('to-dwn', {
            type: 'start-mod-quickcheck',
            mod: $scope.mods[i],
            path: $rootScope.ArmaPath
          })
        } else {
          $scope.mods[i].state = [0, 'Arma 3 Pfad nicht gesetzt']
        }
      } else {
        $scope.mods[i].state = [3, 'Spielen']
      }
    }
  }

  $scope.savePath = function (path) {
    if (path !== false) {
      alertify.set({labels: {ok: 'Richtig', cancel: 'Falsch'}})
      alertify.confirm('Arma Pfad gefunden: ' + path, function (e) {
        if (e) {
          $rootScope.ArmaPath = path + '\\'
          storage.set('settings', {armapath: $rootScope.ArmaPath}, function (error) {
            if (error) throw error
          })
          getMods()
        } else {
          $('#settingsTab').tab('show')
        }
      })
    } else {
      $('#settingsTab').tab('show')
    }
  }

  $scope.checkregkey1 = function () {
    var regKey = new Winreg({
      hive: Winreg.HKLM,
      key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 107410'
    })

    regKey.keyExists(function (err, exists) {
      if (err) throw err
      if (exists) {
        regKey.values(function (err, items) {
          if (err) throw err
          if (fs.existsSync(items[3].value + '\\arma3.exe')) {
            $scope.savePath(items[3].value)
          } else {
            $scope.checkregkey2()
          }
        })
      } else {
        $scope.checkregkey2()
      }
    })
  }

  $scope.checkregkey2 = function () {
    var regKey = new Winreg({
      hive: Winreg.HKLM,
      key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 107410'
    })

    regKey.keyExists(function (err, exists) {
      if (err) throw err
      if (exists) {
        regKey.values(function (err, items) {
          if (err) throw err
          if (fs.existsSync(items[3].value + '\\arma3.exe')) {
            $scope.savePath(items[3].value)
          } else {
            $scope.checkregkey3()
          }
        })
      } else {
        $scope.checkregkey3()
      }
    })
  }

  $scope.checkregkey3 = function () {
    var regKey = new Winreg({
      hive: Winreg.HKLM,
      key: '\\SOFTWARE\\WOW6432Node\\bohemia interactive studio\\ArmA 3'
    })

    regKey.keyExists(function (err, exists) {
      if (err) throw err
      if (exists) {
        regKey.values(function (err, items) {
          if (err) throw err
          if (fs.existsSync(items[0].value + '\\arma3.exe')) {
            $scope.savePath(items[0].value)
          } else {
            $scope.savePath(false)
          }
        })
      } else {
        $scope.savePath(false)
      }
    })
  }
}
])
App.controller('settingsController', ['$scope', '$rootScope', function ($scope, $rootScope) {
  $scope.init = function () {
    storage.get('settings', function (error, data) {
      if (error) throw error

      $rootScope.ArmaPath = data.armapath
      $scope.splash = data.splash
      if ($scope.splash) {
        $('#splashCheck').iCheck('check')
      }
      $scope.intro = data.intro
      if ($scope.intro) {
        $('#introCheck').iCheck('check')
      }
      $scope.ht = data.ht
      if ($scope.ht) {
        $('#htCheck').iCheck('check')
      }
      $scope.windowed = data.windowed
      if ($scope.windowed) {
        $('#windowedCheck').iCheck('check')
      }
      $scope.mem = parseInt(data.mem)
      $scope.cpu = parseInt(data.cpu)
      $scope.vram = parseInt(data.vram)
      $scope.thread = parseInt(data.thread)
      $scope.add_params = data.add_params
      $scope.loaded = true
    })
  }

  $('#splashCheck').on('ifChecked', function (event) {
    if ($scope.loaded) {
      $scope.splash = true
      $scope.saveSettings()
    }
  }).on('ifUnchecked', function (event) {
    if ($scope.loaded) {
      $scope.splash = false
      $scope.saveSettings()
    }
  })

  $('#introCheck').on('ifChecked', function (event) {
    if ($scope.loaded) {
      $scope.intro = true
      $scope.saveSettings()
    }
  }).on('ifUnchecked', function (event) {
    if ($scope.loaded) {
      $scope.intro = false
      $scope.saveSettings()
    }
  })

  $('#htCheck').on('ifChecked', function (event) {
    if ($scope.loaded) {
      $scope.ht = true
      $scope.saveSettings()
    }
  }).on('ifUnchecked', function (event) {
    if ($scope.loaded) {
      $scope.ht = false
      $scope.saveSettings()
    }
  })

  $('#windowedCheck').on('ifChecked', function (event) {
    if ($scope.loaded) {
      $scope.windowed = true
      $scope.saveSettings()
    }
  }).on('ifUnchecked', function (event) {
    if ($scope.loaded) {
      $scope.windowed = false
      $scope.saveSettings()
    }
  })

  $('#lightSwitch').on('ifChecked', function (event) {
    if ($scope.loaded) {
      $rootScope.theme = 'light'
      $rootScope.$apply()
      $scope.saveSettings()
    }
  }).on('ifUnchecked', function (event) {
    if ($scope.loaded) {
      $rootScope.theme = 'dark'
      $rootScope.$apply()
      $scope.saveSettings()
    }
  })

  $scope.saveSettings = function () {
    storage.set('settings', {
      armapath: $rootScope.ArmaPath,
      splash: $scope.splash,
      intro: $scope.intro,
      ht: $scope.ht,
      windowed: $scope.windowed,
      mem: $scope.mem,
      cpu: $scope.cpu,
      vram: $scope.vram,
      thread: $scope.thread,
      add_params: $scope.add_params,
      theme: $rootScope.theme
    }, function (error) {
      if (error) throw error
    })
  }

  $scope.chooseArmaPath = function () {
    var options = {
      filters: [{
        name: 'arma3_x64',
        extensions: ['exe']
      }],
      title: 'Bitte wähle deine Arma3_x64.exe aus',
      properties: ['openFile']
    }
    var path = String(dialog.showOpenDialog(options))
    if (path !== 'undefined' && path.indexOf('\\arma3_x64.exe') > -1) {
      $rootScope.ArmaPath = path.replace('arma3_x64.exe', '')
      $scope.saveSettings()
      $rootScope.refresh()
    } else {
      $rootScope.ArmaPath = ''
      $scope.saveSettings()
    }
  }
}])

App.controller('aboutController', ['$scope', function ($scope) {
  $scope.version = app.getVersion()
}])

App.controller('serverController', ['$scope', '$sce', ($scope, $sce) => {
    $scope.changePlayersList = (server, side) => {
    switch (side) {
    case 'Zivilisten':
        if (server.ListSide === 'Zivilisten') {
            $scope.resetPlayerList(server)
        } else {
            server.PlayersShow = server.Side.Civs
            server.PlayercountShow = server.Side.Civs.length
            server.ListSide = 'Zivilisten'
        }
        break
    case 'Polizisten':
        if (server.ListSide === 'Polizisten') {
            $scope.resetPlayerList(server)
        } else {
            server.PlayersShow = server.Side.Cops
            server.PlayercountShow = server.Side.Cops.length
            server.ListSide = 'Polizisten'
        }
        break
    case 'Medics':
        if (server.ListSide === 'Medics') {
            $scope.resetPlayerList(server)
        } else {
            server.PlayersShow = server.Side.Medics
            server.PlayercountShow = server.Side.Medics.length
            server.ListSide = 'Medics'
        }
        break
    case 'RAC':
        if (server.ListSide === 'RAC') {
            $scope.resetPlayerList(server)
        } else {
            server.PlayersShow = server.Side.RAC
            server.PlayercountShow = server.Side.RAC.length
            server.ListSide = 'RAC'
        }
        break
    }
}

$scope.resetPlayerList = (server) => {
    server.PlayersShow = server.Players
    server.PlayercountShow = server.Playercount
    server.ListSide = 'Spieler'
}

$scope.copyToClip = (server) => {
    copyToClipboard(server.IpAddress + ':' + server.Port)
    alertify.log('Kopiert', 'success')
}

$scope.redrawChart = (server) => {
    server.chart = new Chart($('#serverChart' + server.Id), { // eslint-disable-line
        type: 'doughnut',
        data: {
            labels: [
                'Zivilisten',
                'Polizisten',
                'Medics',
                'RAC'
            ],
            datasets: [
                {
                    data: [server.Civilians, server.Cops, server.Medics, server.Adac],
                    backgroundColor: [
                        '#8B008B',
                        '#0000CD',
                        '#228B22',
                        '#C00100'
                    ]
                }]
        },
        options: {
            responsive: false,
            legend: {
                position: 'bottom'
            },
            animation: {
                animateScale: true
            },
            tooltips: {
                displayColors: false
            }
        }
    })
}

$scope.init = () => {
    $scope.loading = true
    getServers()
    getNotification()
    $scope.getProfiles()
}

$scope.showTab = (tabindex) => {
    $('.serverTab').removeClass('active')
    $('.serverPane').removeClass('active')
    $('#serverTab' + tabindex).addClass('active')
    $('#serverPane' + tabindex).addClass('active')
}

$scope.getProfiles = () => {
    $scope.profiles = {
        'available': []
    }

    storage.get('profile', (err, data) => {
        if (err) throw err

        $scope.profiles.selected = data.profile
})

    let profileDir = app.getPath('documents') + '\\Arma 3 - Other Profiles'

    try {
        fs.lstatSync(profileDir).isDirectory()
        let profiles = fs.readdirSync(profileDir).filter(file => fs.statSync(path.join(profileDir, file)).isDirectory())
        profiles.forEach((profile, i) => {
            $scope.profiles.available.push(decodeURIComponent(profile))
    })
    } catch (e) {
        console.log(e)
        $scope.profiles = false
    }
}

$scope.setProfile = () => {
    storage.set('profile', {
        profile: $scope.profiles.selected
    }, (err) => {
        if (err) throw err
    })
}

ipcRenderer.on('to-app', (event, args) => {
    switch (args.type) {
case 'servers-callback':
    $scope.servers = args.data.data
    $scope.loading = false
    $scope.$apply()
    if (typeof $scope.servers !== 'undefined') {
        $scope.servers.forEach((server) => {
            server.DescriptionHTML = $sce.trustAsHtml(server.Description)
        server.last_update = getRefreshTime(server.updated_at.date)
        server.PlayersShow = server.Players
        server.PlayercountShow = server.Playercount
        server.ListSide = 'Spieler'
        server.ping = false
        $scope.redrawChart(server)
        $('#playerScroll' + server.Id).perfectScrollbar()
        ping.promise.probe(server.IpAddress)
            .then(function (res) {
                server.ping = res.time
            })
    })
    }
    break
}
})

$scope.joinServer = (server) => {
    if (server.appId === 107410) {
        storage.get('settings', (err, data) => {
            if (err) throw err

            let params = []

            params.push('-noLauncher')
        params.push('-useBE')
        params.push('-connect=' + server.IpAddress)
        params.push('-port=' + server.Port)
        params.push('-mod=' + server.StartParameters)
        params.push('-password=' + server.ServerPassword)

        if ($scope.profiles && typeof $scope.profiles.selected !== 'undefined') {
            params.push('-name=' + $scope.profiles.selected)
        }

        if (data.splash) {
            params.push('-nosplash')
        }
        if (data.intro) {
            params.push('-skipIntro')
        }
        if (data.ht) {
            params.push('-enableHT')
        }
        if (data.windowed) {
            params.push('-window')
        }

        if (data.mem && typeof data.mem !== 'undefined') {
            params.push('-maxMem=' + data.mem)
        }
        if (data.vram && typeof data.vram !== 'undefined') {
            params.push('-maxVRAM=' + data.vram)
        }
        if (data.cpu && typeof data.cpu !== 'undefined') {
            params.push('-cpuCount=' + data.cpu)
        }
        if (data.thread && typeof data.thread !== 'undefined') {
            params.push('-exThreads=' + data.thread)
        }
        if (data.add_params && typeof data.add_params !== 'undefined') {
            params.push(data.add_params)
        }

        spawnNotification('Arma wird gestartet...')
        alertify.log('Arma wird gestartet...', 'success')
        child.spawn((data.armapath + '\\arma3launcher.exe'), params, [])
        console.log(params)
    })
    } else {
        alertify.log('Das Spiel wird gestartet...', 'success')
        shell.openExternal('steam://connect/' + server.IpAddress + ':' + server.Port)
    }
}

$scope.pingServer = (server) => {
    ipcRenderer.send('to-web', {
        type: 'ping-server-via-rdp',
        server: server
    })
}
}])


App.controller('tfarController', ['$scope', '$rootScope', function ($scope) {
    $scope.initFileDownload = function (file) {
        if (!$scope.fileDownloading) {
            $scope.fileDownloading = true
            ipcRenderer.send('to-web', {
                type: 'start-file-download',
                file: file
            })
        } else {
            alertify.log('Download läuft bereits', 'danger')
        }
    }

    $scope.fileProgress = 0
    $scope.fileSpeed = 0
    $scope.fileDownloading = false

    ipcRenderer.on('to-app', function (event, args) {
        switch (args.type) {
            case 'update-dl-progress-file':
                $scope.fileProgress = toProgress(args.state.percent)
                $scope.fileSpeed = toMB(args.state.speed)
                $scope.$apply()
                break
            case 'update-dl-progress-file-done':
                $scope.fileProgress = 100
                $scope.fileSpeed = 0
                $scope.fileDownloading = false
                $scope.$apply()
                alertify.log('Wird ausgeführt...', 'primary')
                if (!shell.openItem(args.filePath)) {
                    alertify.log('Fehlgeschlagen', 'danger')
                    var stream = fs.createReadStream(args.filePath).pipe(unzip.Extract({path: app.getPath('downloads') + '\\ArtOfRP'}))
                    stream.on('close', function () {
                        try {
                            fs.unlinkSync(app.getPath('downloads') + '\\ArtOfRP\\package.ini')
                        } catch (err) {
                            console.log(err)
                        }
                        shell.showItemInFolder(app.getPath('downloads') + '\\ArtOfRP')
                    })
                }
                break
        }
    })
}])

function getMods () {
  ipcRenderer.send('to-web', {
    type: 'get-url',
    callback: 'mod-callback',
    url: APIBaseURL + APIModsURL,
    callBackTarget: 'to-app'
  })
}


function getServers () {
    ipcRenderer.send('to-web', {
        type: 'get-url',
        callback: 'servers-callback',
        url: APIBaseURL + APIServersURL,
        callBackTarget: 'to-app'
    })
}

const getNotification = () => {
    ipcRenderer.send('to-web', {
        type: 'get-url',
        callback: 'notification-callback',
        url: APIBaseURL + APINotificationURL,
        callBackTarget: 'to-app'
    })
}


function toGB (val) {
  return (val / 1000000000).toFixed(3)
}

function toMB (val) {
  return (val / 1000000).toFixed(3)
}

function toProgress (val) {
  return (val * 100).toFixed(3)
}

function toFileProgress (filesize, downloaded) {
  return (100 / filesize * downloaded).toFixed(2)
}

function spawnNotification (message) {
  new Notification('ArtOfRP', { // eslint-disable-line
    body: message
  })
}

function appLoaded () { // eslint-disable-line
  ipcRenderer.send('app-loaded')
}

const cutName = (name) => {
    if (name.length > 30) {
        return name.substring(0, 30) + '...'
    } else {
        return name
    }
}

const getRefreshTime = (date) => {
    let d = new Date(date)
    let hours = d.getHours()
    let minutes = d.getMinutes()
    if (hours < 10) hours = '0' + hours
    if (minutes < 10) minutes = '0' + minutes

    return hours + ':' + minutes
}

const copyToClipboard = (text) => {
    clipboard.writeText(text)
    return text
}

ipcRenderer.on('update-downloaded', function (event, args) {
  spawnNotification('Update ' + args.releaseName + ' bereit.')
  alertify.set({labels: {ok: 'Update', cancel: 'Abbrechen'}})
  alertify.confirm('Update zur Version ' + args.releaseName + ' bereit.', function (e) {
    if (e) {
      ipcRenderer.send('restart-update')
    }
  })
})
