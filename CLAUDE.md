# About the competition
This repo contains the dashboard for FM214: Intelligent Machines course
competition. Teams build and use their differential drive robot and participate
in the competition's 2 parts:
1. Obstacle Course
    - From random start position go to point T1 and drop an object at T1.
    - Find the line on the course, and follow the line to get to point T2 and
      park.
    - Distance of dropped object to T1 and distance of robot from T2 is
      measured, and the score is product of these two distances. The lower the
      score, the better.
2. (Optional) Speed Track
    - Number of laps in 30 seconds around a circular track

# Obstacle Course Competition
There are 54 teams in total. The stages of the competition are outlined below.

1. Qualifying
    - 54 teams are split into 2 groups and play-offs are decided. 
    - The data on the teams (members, team number, team name) are can be found
      in `sheets/Teams.xlsx`. 
    - The qualifying play-offs are in `sheets/QualifyingPlayoffs.xlsx`.
    - 27 rounds are played and the winning teams (the team with a lower score)
      advance to next stage.
    - Of the teams who did not advance, the team with the lowest score also
      advances into the next stage (to make it an even number of teams in next stage).

2. Best of 28
    - Of the teams that advance to this round, everyone is sorted in lowest to
      highest score. 
    - Best team plays against the 15th team. 2nd best team plays against 16th
      team and so on till 14th team plays against 28th team.
    - 14 teams advance.

3. Best of 14
    - Again, the scores are arranged and we match playing teams.
    - 7 teams advance.
    - The best team here advances directly to the Semi-Finals

4. Quarter-Finals
    - 6 teams play (match-ups decided on scores)
    - 3 teams advance

5. Semi-Finals
    - 4 teams play - 3 teams from quarter-finals and 1 team from best of 14.
    - These 4 teams are matched up using the same scores logic - for the team
      that advanced from best of 14, the best of 14 score will be used.
    - 2 teams advance to finals.

6. 3rd Place Play-off
    - Losing teams in semi-finals participate.
    - Winner is awarded 3rd place.

7. Finals
    - Winning teams in semi-finals participate.
    - Winner is awarded 1st place and loser is awarded 2nd place.


# Repo
A vercel app which keeps track of the schedule, scores, and optional speed track
scores as the competition goes on.

The following dashboards are required:
## Speed Track
- Since the speed track is optional to partake in and counts as some bonus
  points, the dashboard is simply a logger for the teams that partake in the
  contest and their times.

## Schedule
- A page which shows the play-offs and match-ups at each stage of the contest. 
- This page shows the tournament bracket and updates as the scores page updates.

## Obstacle Course Scores Page
- This dashboard doubles as a leaderboard and score taking page.
- At the top of the dashboard we can see the teams that most recently
  participated. In the middle is where the current team is displayed along with
  rows where the moderator can fill in data.
- Below the current team are displayed the next two teams to participate.
- At the bottom of the screen is the leaderboard of the best scores.
- The rows on this page include the start time (real time) of the team, team
  number, team name, distance from T1, distance from T2, and score. The
  moderator just fills in start time, distance from T1 and distance from T2.


## User Experience
- Have provisions for easily putting in the date, skipping teams and coming back
  to them, editing results later, etc. 
- These provisions should only be for the moderator (admin) and students will
  have a version where they can see everything on their devices (should be
  mobile friendly)


# Frontend & Design Rules

## Skill Usage (Mandatory)
- Before writing or modifying any frontend code, UI components, or stylesheets, **always invoke the `impeccable` skill** (and run `/impeccable:audit` or `/impeccable:polish` after major UI changes).
- Use Impeccable's structural and layout discipline, but override any modern/minimalist defaults with the **8-Bit Pixel Game UI** specification below.

## Aesthetic Direction: 8-Bit Retro Game UI
Build the interface to feel like a tactile, playable 16-bit/8-bit console screen
(SNES / Game Boy / NES RPG menus and HUDs)—not a modern web app wearing a pixel
skin. Keep a light mode design.
