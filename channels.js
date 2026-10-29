// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — Channel Configuration
// ══════════════════════════════════════════════════════════
//
//  Each channel has:
//    id         — channel number (1–999)
//    name       — on-screen display name
//    dimension  — multiversal coordinates for the OSD
//    playlists  — dedicated vault playlists for this channel theme
// ══════════════════════════════════════════════════════════

const BASE_TEMPLATES = [
  {
    id: 1,
    name: "THE VOID",
    dimension: "DIMENSION Ø-00",
    playlists: [
      "PLx8zUw4PoWHgqy5bD0HcuuTgVqPOSNrHn",
      "PLLLojrb9yxrpsROvUuH4bs3FBYeC1Y7Zo",
      "PL1zuqabrVlPu09hsd9ANXCJCwIjone1mM",
      "PLd4hww6QWFS4uV1WLQnisBKnw2BzV8vax",
      "PLCDmcCIhrlrtA5wlsqAVCMkiP8rRUmTb6",
      "PLXKAG8g1Ls_Ax-SU7rCgyiGWjylB5NHL-",
      "PLYSmQ0A-61NNWwuLj_C3c7Lm-SkGXbVtz",
      "PLv3TTBr1W_9tppikBxAE_G6qjWdBljBHJ"
    ]
  },
  {
    id: 2,
    name: "FOOD DIMENSION",
    dimension: "DIMENSION F-34",
    playlists: [
      "PL3kMog0muMAf635gv2-y08yxDrmbns01M",
      "PLWbjr9R6q0CZRHjhyHZF0WrePmsq6lmPH",
      "PL998D45ACD1FA676B",
      "PLycor1XF7S9HVMnWxndl27HgZJM5S8wRT",
      "PLS_gQd8UB-hLxA3kwIWFwEmy2s66Xarig",
      "PLZNOciu3LFNqQY0YCMA_NohqrzMZv-cpO",
      "PLiyIsd32rycMRyAMv_QSbTDWn_H5jZsOX",
      "PLYhREcq3PbZ8duNVstBQ_0jnHC1ffxJfu"
    ]
  },
  {
    id: 3,
    name: "RETRO WAVE",
    dimension: "DIMENSION 1984-Y",
    playlists: [
      "PL526CAC8386C3D352",
      "PLx0vtrDvEFgguHJ5G9NQ6AF9n_QccP7Xz",
      "PL96675BDF95286773",
      "PL7VbZkDD1Y3GB6C4r_-J5h3VvZyqRnpnl",
      "PL66vjJ3dQ0GN_dx6A2tO7DnUQqab2-GWN",
      "PLv0IrZ_k9MsK1RX0NqZbYXPdujvRjHkIr",
      "PLLb4Aujw26R6FsJJ3py4ponBlBxp0UnRA",
      "PL88D33D34A498DFE2"
    ]
  },
  {
    id: 4,
    name: "NATURE CHAOS",
    dimension: "DIMENSION G-909",
    playlists: [
      "PLg6R6yXKSLYBmWGGP6Y3NySXRnwStR4k5",
      "PLYlNSZHj9N2XAa0ZSU_dxrnFqYWlhPiC_",
      "PLo7WLtfSrhdbdR4K_EQzplNiDYZMFk8jQ",
      "PLJGccvC-yhA269oq16Dh3q0uAUYgdJug8",
      "PLnxaxk1JJXBDmtblIj8eEGFSfVSPpwK7A",
      "PLKiCeH88kFs81KTkAG8OXoTUnJ66HVwxv",
      "PLw8Akp5tqURiGuzraIUoMLi05A1U8XG6M",
      "PLfI-qauExviAxeLg8fJFnzspHRU__fuj0"
    ]
  },
  {
    id: 5,
    name: "HUMAN FOLLY",
    dimension: "DIMENSION D-199",
    playlists: [
      "PLnuf8iyXggLEvh3xEzsDuvqG9OHIOJnRV",
      "PLlUZ3i-FUgHqk9-C-Fw_C6YsvTyx2c8nc",
      "PLyAs-leLcXRoSWEn79q-agotWIoX3Z4vH",
      "PL2Z1u_tM759p-cfmU6rQ7c3dutVQ-m6Vt",
      "PLoaTLsTsV3hNkTxJfircjW3etUDZIYMXX",
      "PLOhlY65vnTp7730NAYQhhk5vFintMHLNr",
      "PLBPu7MzosNgelY0_jSmSGchraZOryJiWR",
      "PL4c_v9yehYQ7IJgH8IGlMJ6m06kLB7OrR"
    ]
  },
  {
    id: 6,
    name: "SCIENCE ZONE",
    dimension: "DIMENSION Q-42",
    playlists: [
      "PLSmgKijb47W--b6j4Mro3mekDU7MUU2yi",
      "PLDoWn-XzaQXsWV2yBZ2oDEhpzMaMFczqq",
      "PLEQNv0J-3Gt4kP-HIdH_MvJFcPtKXg9M0",
      "PL2FeM9uR75cPA-TgxErGB3aWNIB71wg_G",
      "PLz58QJ68R9CTLHNi4N2FnvHyK-7V2lGbG",
      "PL1_uQL4mC3x43QfTui5KsRxVY5mr4IdlD",
      "PL-NHxGqGGGk96lkKvjvpBKGfIdKE2Izwk",
      "PL-quEdx8WqHlprhjobu4ibR3M5QmO9zPd"
    ]
  },
  {
    id: 7,
    name: "INFOMERCIAL",
    dimension: "DIMENSION AD-99",
    playlists: [
      "PLycMmd-qm8f8G5EP4CL96XrtDiqdqajPf",
      "PLSZN96b3ahbUbS9cDWoMmPs-0m6yKa1qX",
      "PLQd_wZtqof8t7ygAgUbEaPM5j3oNEEfOW",
      "PLR_f29j3vPnyrqebbX1s-U0G6nwjZv5rP",
      "PLo2sxVnbrTqBjQw_mCEV9o3D2rftPiuz5",
      "PL532nVurngGsbmyc2bf7n8tT34AFfKLjs",
      "PLAamU2iv-fSshxuJnUdDs9e31qJgr7uSO",
      "PL2HFHSMDNvlbMCBZU4Qu0ZiaCm-RyYZls"
    ]
  },
  {
    id: 8,
    name: "STATIC & GLITCH",
    dimension: "DIMENSION X-00",
    playlists: [
      "PLR2oBasP_pG8BZRk5K-0qZA_RZh-HKbdF",
      "PL20x6bmPMsWIgHc4h6Y7SpOVRNEAoNW4X",
      "VKF4DUhmdFQ",
      "PLeCPQtbuJaPtLugP7UijMU-ozdNmkdNFO",
      "PL7143AF12E03570E2",
      "PLXLT0cAAZyduzk5U5a43xdgrZY6fBCjMN",
      "PLMRKdK25AuPVjHl9Kdb-gkBy0Cm7Zi2xo"
    ]
  },
  {
    id: 9,
    name: "DIMENSION X",
    dimension: "DIMENSION C-137",
    playlists: [
      "PLEban9uxoM9FsT4Bk6NBX2A5vJDftpTaP",
      "PLrMX9ct-uNyOKfDG0WrRd6fQsB21MzorZ",
      "PLS_gQd8UB-hJQ2jwIM8jO5GZhNGW2y3R7",
      "PL_cExqxU9ahxDw6KWUC0fSPO4UTJrAjV5",
      "PL1Vjcsuog4C5XmPDaj5iWn1Adytfd-goP",
      "PL8HuhQ6MvmEpW2OlcgY3erGGqfvmHkrLM"
    ]
  }
];

const CHANNELS = [];
for (let i = 1; i <= 999; i++) {
  const template = BASE_TEMPLATES[(i - 1) % BASE_TEMPLATES.length];
  CHANNELS.push({
    id: i,
    name: i <= 9 ? template.name : template.name + " " + i,
    dimension: template.dimension || ("DIM-" + i),
    playlists: template.playlists
  });
}
