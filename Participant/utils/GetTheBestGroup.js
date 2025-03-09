function getTheBestGroup(participant, groups) {

  
  // Check if all groups are full
  const allFull = groups.every(group => group.participants.length >= group.max);
  if (allFull) {
      return groups[Math.floor(Math.random() * groups.length)];
  }

  // Filter non-full groups
  const nonFullGroups = groups.filter(group => group.participants.length < group.max);

  // Find minimum participant count in non-full groups
  const minParticipants = Math.min(...nonFullGroups.map(g => g.participants.length));

  // Candidate groups (same minimum size, original order)
  const candidateGroups = nonFullGroups
      .filter(g => g.participants.length === minParticipants)
      .sort((a, b) => groups.indexOf(a) - groups.indexOf(b));

  // Find groups with no region conflicts
  const participantRegion = participant.region;
  const groupsWithoutConflict = candidateGroups.filter(
      group => !group.participants.some(p => p.region === participantRegion)
  );

  if (groupsWithoutConflict.length > 0) {
      return groupsWithoutConflict[0];
  }

  // Find non-full groups with the fewest participants from the same region
  const groupsWithCount = nonFullGroups.map(group => ({
      group,
      count: group.participants.filter(p => p.region === participantRegion).length
  }));

  const minCount = Math.min(...groupsWithCount.map(g => g.count));
  const minCountGroups = groupsWithCount
      .filter(g => g.count === minCount)
      .map(g => g.group);

  // Select by size and original order
  const minSize = Math.min(...minCountGroups.map(g => g.participants.length));
  const finalGroups = minCountGroups
      .filter(g => g.participants.length === minSize)
      .sort((a, b) => groups.indexOf(a) - groups.indexOf(b));

  return finalGroups[0];
}

module.exports = getTheBestGroup;