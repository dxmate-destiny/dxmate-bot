function convertToMatchModeName (matchMode) {
    let matchModeName;

    switch (matchMode) {
        case 'ranked_singles':
            matchModeName = 'Ranked Singles';
            break;
        case 'ranked_doubles':
            matchModeName = 'Ranked Doubles';
            break;
        case 'unranked_singles':
            matchModeName = 'Unranked Singles';
            break;
        case 'unranked_doubles':
            matchModeName = 'Unranked Doubles';
            break;
    }

    return matchModeName;
}

function convertNumberToEmoji (number) {
    const emojiNumbers = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

    if (number >= 1 && number <= 9) {
        return emojiNumbers[number - 1];
    } else {
        return "Invalid number";
    }
}

function convertTeamToEmoji (team) {
    let emoji;

    switch (team) {
        case 'red':
            emoji = '🔴';
            break;
        case 'blue':
            emoji = '🔵'
    }

    return emoji;
}

function convertTeamToName (team) {
    let teamName;

    switch (team) {
        case 'red':
            teamName = 'RED';
            break;
        case 'blue':
            teamName = 'BLUE'
    }

    return teamName;
}

module.exports = { convertToMatchModeName, convertNumberToEmoji, convertTeamToEmoji, convertTeamToName };