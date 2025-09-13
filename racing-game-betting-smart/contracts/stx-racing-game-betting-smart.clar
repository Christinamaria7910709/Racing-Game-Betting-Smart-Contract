;; Racing Game Betting Smart Contract
;; Virtual horse/car racing with betting mechanics

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-OWNER-ONLY (err u100))
(define-constant ERR-NOT-FOUND (err u101))
(define-constant ERR-RACE-NOT-FOUND (err u102))
(define-constant ERR-RACE-ENDED (err u103))
(define-constant ERR-RACE-NOT-ENDED (err u104))
(define-constant ERR-INSUFFICIENT-FUNDS (err u105))
(define-constant ERR-UNAUTHORIZED (err u106))
(define-constant ERR-INVALID-BET (err u107))
(define-constant ERR-RACE-ALREADY-STARTED (err u108))
(define-constant ERR-NO-BETS (err u109))
(define-constant ERR-INVALID-RACER (err u110))
(define-constant ERR-ALREADY-CLAIMED (err u111))

;; Data Variables
(define-data-var race-id-counter uint u0)
(define-data-var bet-id-counter uint u0)
(define-data-var house-edge uint u250) ;; 2.5% house edge (250 basis points)
(define-data-var min-bet uint u100) ;; Minimum bet amount
(define-data-var max-bet uint u100000) ;; Maximum bet amount

;; Data Maps
(define-map races
  uint ;; race-id
  {
    name: (string-ascii 50),
    racers: (list 8 (string-ascii 30)), ;; Up to 8 racers
    start-time: uint,
    end-time: uint,
    status: (string-ascii 20), ;; "open", "running", "finished", "cancelled"
    winner: uint, ;; racer index (0-based), none if not finished
    total-pool: uint,
    house-take: uint
  }
)

(define-map race-racers
  {race-id: uint, racer-index: uint}
  {
    name: (string-ascii 30),
    odds: uint, ;; Multiplied by 100 (e.g., 250 = 2.5x odds)
    total-bets: uint,
    position: uint ;; Final position (1st, 2nd, 3rd, etc.)
  }
)

(define-map bets
  uint ;; bet-id
  {
    race-id: uint,
    bettor: principal,
    racer-index: uint,
    amount: uint,
    potential-payout: uint,
    claimed: bool,
    bet-type: (string-ascii 20) ;; "win", "place", "show"
  }
)

(define-map user-bets
  {user: principal, race-id: uint}
  (list 20 uint) ;; List of bet-ids for this user in this race
)

(define-map user-balances
  principal
  uint
)

(define-map race-results
  uint ;; race-id
  (list 8 uint) ;; Final positions of all racers (racer-index)
)

;; Token Management Functions
(define-public (deposit-funds (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-BET)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set user-balances tx-sender 
             (+ (default-to u0 (map-get? user-balances tx-sender)) amount))
    (ok amount)
  )
)

(define-public (withdraw-funds (amount uint))
  (let ((balance (default-to u0 (map-get? user-balances tx-sender))))
    (asserts! (>= balance amount) ERR-INSUFFICIENT-FUNDS)
    (map-set user-balances tx-sender (- balance amount))
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
    (ok amount)
  )
)

(define-read-only (get-balance (user principal))
  (default-to u0 (map-get? user-balances user))
)

;; Race Management Functions
(define-public (create-race 
  (name (string-ascii 50))
  (racers (list 8 (string-ascii 30)))
  (duration-blocks uint)
)
  (let ((new-race-id (+ (var-get race-id-counter) u1)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (>= (len racers) u2) ERR-INVALID-RACER)
    
    ;; Create race
    (map-set races new-race-id
      {
        name: name,
        racers: racers,
        start-time: stacks-block-height,
        end-time: (+ stacks-block-height duration-blocks),
        status: "open",
        winner: u999, ;; Invalid index means no winner yet
        total-pool: u0,
        house-take: u0
      }
    )
    
    ;; Initialize racer data with default odds
    (initialize-racers new-race-id racers)
    
    ;; Update counter
    (var-set race-id-counter new-race-id)
    (ok new-race-id)
  )
)

(define-private (initialize-racers (race-id uint) (racers (list 8 (string-ascii 30))))
  (begin
    (initialize-single-racer race-id u0 (default-to "" (element-at racers u0)))
    (initialize-single-racer race-id u1 (default-to "" (element-at racers u1)))
    (initialize-single-racer race-id u2 (default-to "" (element-at racers u2)))
    (initialize-single-racer race-id u3 (default-to "" (element-at racers u3)))
    (initialize-single-racer race-id u4 (default-to "" (element-at racers u4)))
    (initialize-single-racer race-id u5 (default-to "" (element-at racers u5)))
    (initialize-single-racer race-id u6 (default-to "" (element-at racers u6)))
    (initialize-single-racer race-id u7 (default-to "" (element-at racers u7)))
    true
  )
)

(define-private (initialize-single-racer (race-id uint) (racer-index uint) (racer-name (string-ascii 30)))
  (if (> (len racer-name) u0)
      (map-set race-racers {race-id: race-id, racer-index: racer-index}
        {
          name: racer-name,
          odds: u200, ;; Default 2.0x odds
          total-bets: u0,
          position: u0
        }
      )
      true
  )
)

(define-public (start-race (race-id uint))
  (let ((race (unwrap! (map-get? races race-id) ERR-RACE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (is-eq (get status race) "open") ERR-RACE-ALREADY-STARTED)
    
    (map-set races race-id (merge race {status: "running"}))
    (ok true)
  )
)

(define-read-only (get-race (race-id uint))
  (map-get? races race-id)
)

(define-read-only (get-racer (race-id uint) (racer-index uint))
  (map-get? race-racers {race-id: race-id, racer-index: racer-index})
)

;; Betting Functions
(define-public (place-bet 
  (race-id uint)
  (racer-index uint)
  (amount uint)
  (bet-type (string-ascii 20))
)
  (let (
    (race (unwrap! (map-get? races race-id) ERR-RACE-NOT-FOUND))
    (racer (unwrap! (map-get? race-racers {race-id: race-id, racer-index: racer-index}) ERR-INVALID-RACER))
    (user-balance (get-balance tx-sender))
    (new-bet-id (+ (var-get bet-id-counter) u1))
    (odds (get odds racer))
    (potential-payout (/ (* amount odds) u100))
  )
    ;; Validations
    (asserts! (is-eq (get status race) "open") ERR-RACE-ALREADY-STARTED)
    (asserts! (>= amount (var-get min-bet)) ERR-INVALID-BET)
    (asserts! (<= amount (var-get max-bet)) ERR-INVALID-BET)
    (asserts! (>= user-balance amount) ERR-INSUFFICIENT-FUNDS)
    
    ;; Deduct bet amount from user balance
    (map-set user-balances tx-sender (- user-balance amount))
    
    ;; Create bet record
    (map-set bets new-bet-id
      {
        race-id: race-id,
        bettor: tx-sender,
        racer-index: racer-index,
        amount: amount,
        potential-payout: potential-payout,
        claimed: false,
        bet-type: bet-type
      }
    )
    
    ;; Update racer betting data
    (map-set race-racers {race-id: race-id, racer-index: racer-index}
             (merge racer {total-bets: (+ (get total-bets racer) amount)}))
    
    ;; Update race total pool
    (map-set races race-id (merge race {total-pool: (+ (get total-pool race) amount)}))
    
    ;; Add bet to user's bet list
    (asserts! (add-bet-to-user-list tx-sender race-id new-bet-id) ERR-INVALID-BET)
    
    ;; Update bet counter
    (var-set bet-id-counter new-bet-id)
    
    ;; Update odds based on betting volume
    (update-odds race-id)
    
    (ok new-bet-id)
  )
)

(define-private (add-bet-to-user-list (user principal) (race-id uint) (bet-id uint))
  (let ((current-bets (default-to (list) (map-get? user-bets {user: user, race-id: race-id}))))
    (match (as-max-len? (append current-bets bet-id) u20)
      new-list (begin
                 (map-set user-bets {user: user, race-id: race-id} new-list)
                 true)
      true ;; Changed from false to true to maintain bool type consistency
    )
  )
)

(define-private (update-odds (race-id uint))
  (let ((race (unwrap-panic (map-get? races race-id))))
    ;; Update odds for all racers based on betting volume
    (update-racer-odds race-id u0 (get total-pool race))
    (update-racer-odds race-id u1 (get total-pool race))
    (update-racer-odds race-id u2 (get total-pool race))
    (update-racer-odds race-id u3 (get total-pool race))
    (update-racer-odds race-id u4 (get total-pool race))
    (update-racer-odds race-id u5 (get total-pool race))
    (update-racer-odds race-id u6 (get total-pool race))
    (update-racer-odds race-id u7 (get total-pool race))
    true
  )
)

(define-private (update-racer-odds (race-id uint) (racer-index uint) (total-pool uint))
  (match (map-get? race-racers {race-id: race-id, racer-index: racer-index})
    racer
    (if (> total-pool u0)
        (let ((new-odds (max u110 (/ (* total-pool u100) (max u1 (get total-bets racer))))))
          (map-set race-racers {race-id: race-id, racer-index: racer-index}
                   (merge racer {odds: new-odds}))
        )
        true
    )
    true
  )
)

;; Race Results Functions
(define-public (finish-race 
  (race-id uint)
  (final-positions (list 8 uint)) ;; List of racer indices in finishing order
)
  (let ((race (unwrap! (map-get? races race-id) ERR-RACE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (is-eq (get status race) "running") ERR-RACE-NOT-ENDED)
    
    ;; Set race results
    (map-set race-results race-id final-positions)
    
    ;; Calculate house take
    (let ((house-take (/ (* (get total-pool race) (var-get house-edge)) u10000)))
      ;; Update race status and winner
      (map-set races race-id 
        (merge race {
          status: "finished",
          winner: (unwrap! (element-at final-positions u0) ERR-INVALID-RACER),
          house-take: house-take
        }))
    )
    
    ;; Update racer positions
    (update-all-racer-positions race-id final-positions)
    
    (ok true)
  )
)

(define-private (update-all-racer-positions (race-id uint) (positions (list 8 uint)))
  (begin
    (update-racer-position race-id (default-to u0 (element-at positions u0)) u1)
    (update-racer-position race-id (default-to u0 (element-at positions u1)) u2)
    (update-racer-position race-id (default-to u0 (element-at positions u2)) u3)
    (update-racer-position race-id (default-to u0 (element-at positions u3)) u4)
    (update-racer-position race-id (default-to u0 (element-at positions u4)) u5)
    (update-racer-position race-id (default-to u0 (element-at positions u5)) u6)
    (update-racer-position race-id (default-to u0 (element-at positions u6)) u7)
    (update-racer-position race-id (default-to u0 (element-at positions u7)) u8)
    true
  )
)

(define-private (update-racer-position (race-id uint) (racer-index uint) (position uint))
  (match (map-get? race-racers {race-id: race-id, racer-index: racer-index})
    racer (map-set race-racers {race-id: race-id, racer-index: racer-index}
                   (merge racer {position: position}))
    true
  )
)

;; Payout Functions
(define-public (claim-winnings (bet-id uint))
  (let ((bet (unwrap! (map-get? bets bet-id) ERR-NOT-FOUND)))
    (asserts! (is-eq (get bettor bet) tx-sender) ERR-UNAUTHORIZED)
    (asserts! (not (get claimed bet)) ERR-ALREADY-CLAIMED)
    
    (let (
      (race-id (get race-id bet))
      (race (unwrap! (map-get? races race-id) ERR-RACE-NOT-FOUND))
      (racer-index (get racer-index bet))
      (racer (unwrap! (map-get? race-racers {race-id: race-id, racer-index: racer-index}) ERR-INVALID-RACER))
      (payout (calculate-payout bet racer race))
    )
      (asserts! (is-eq (get status race) "finished") ERR-RACE-NOT-ENDED)
      
      ;; Mark bet as claimed
      (map-set bets bet-id (merge bet {claimed: true}))
      
      ;; Pay out winnings
      (if (> payout u0)
          (map-set user-balances tx-sender (+ (get-balance tx-sender) payout))
          true
      )
      
      (ok payout)
    )
  )
)

(define-private (calculate-payout (bet {race-id: uint, bettor: principal, racer-index: uint, amount: uint, potential-payout: uint, claimed: bool, bet-type: (string-ascii 20)}) (racer {name: (string-ascii 30), odds: uint, total-bets: uint, position: uint}) (race {name: (string-ascii 50), racers: (list 8 (string-ascii 30)), start-time: uint, end-time: uint, status: (string-ascii 20), winner: uint, total-pool: uint, house-take: uint}))
  (let ((position (get position racer))
        (bet-type (get bet-type bet))
        (amount (get amount bet)))
    (if (is-eq bet-type "win")
        ;; Win bet: only pays if racer finished 1st
        (if (is-eq position u1)
            (get potential-payout bet)
            u0
        )
        (if (is-eq bet-type "place")
            ;; Place bet: pays if racer finished 1st or 2nd
            (if (<= position u2)
                (/ (get potential-payout bet) u2) ;; Half payout for place
                u0
            )
            (if (is-eq bet-type "show")
                ;; Show bet: pays if racer finished 1st, 2nd, or 3rd
                (if (<= position u3)
                    (/ (get potential-payout bet) u3) ;; Third payout for show
                    u0
                )
                u0 ;; Invalid bet type
            )
        )
    )
  )
)

;; Query Functions
(define-read-only (get-bet (bet-id uint))
  (map-get? bets bet-id)
)

(define-read-only (get-user-bets (user principal) (race-id uint))
  (default-to (list) (map-get? user-bets {user: user, race-id: race-id}))
)

(define-read-only (get-race-results (race-id uint))
  (map-get? race-results race-id)
)

(define-read-only (get-current-odds (race-id uint) (racer-index uint))
  (match (map-get? race-racers {race-id: race-id, racer-index: racer-index})
    racer (some (get odds racer))
    none
  )
)

(define-read-only (get-race-leaderboard (race-id uint))
  (let ((race (map-get? races race-id)))
    (match race
      race-data
      (some {
        total-pool: (get total-pool race-data),
        status: (get status race-data),
        winner: (get winner race-data)
      })
      none
    )
  )
)

;; Administrative Functions
(define-public (set-house-edge (new-edge uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (<= new-edge u1000) ERR-INVALID-BET) ;; Max 10%
    (var-set house-edge new-edge)
    (ok true)
  )
)

(define-public (set-bet-limits (min-bet-amount uint) (max-bet-amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (< min-bet-amount max-bet-amount) ERR-INVALID-BET)
    (var-set min-bet min-bet-amount)
    (var-set max-bet max-bet-amount)
    (ok true)
  )
)

(define-public (cancel-race (race-id uint))
  (let ((race (unwrap! (map-get? races race-id) ERR-RACE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (not (is-eq (get status race) "finished")) ERR-RACE-ENDED)
    
    (map-set races race-id (merge race {status: "cancelled"}))
    (ok true)
  )
)

(define-public (withdraw-house-funds (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (try! (as-contract (stx-transfer? amount tx-sender CONTRACT-OWNER)))
    (ok amount)
  )
)

;; Helper Functions
(define-private (max (a uint) (b uint))
  (if (> a b) a b)
)

(define-private (min (a uint) (b uint))
  (if (< a b) a b)
)