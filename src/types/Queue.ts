interface Queue {
    players: User[]
    matchFound: boolean
    team1Captain?: User
    team2Captain?: User
    playersMatch?: User[]
    team1: User[]
    team2: User[]
    turn: string
}