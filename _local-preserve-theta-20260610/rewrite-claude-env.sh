OLD_NAME_1="Claude"
OLD_NAME_2="Claude Code"
OLD_NAME_3="Claude Agent"
OLD_NAME_4="Claude (autonomous)"
OLD_EMAIL_1="claude@anthropic.com"
OLD_EMAIL_2="claude-code@anthropic.com"
OLD_EMAIL_3="claude-agent@anthropic.com"
OLD_EMAIL_4="noreply@anthropic.com"
OLD_EMAIL_5="claude-agent@msetech.org"
OLD_EMAIL_6="claude@msetech.local"
OLD_EMAIL_7="claude-code@anthropic.local"

if [ "$GIT_AUTHOR_NAME" = "$OLD_NAME_1" ] || \
   [ "$GIT_AUTHOR_NAME" = "$OLD_NAME_2" ] || \
   [ "$GIT_AUTHOR_NAME" = "$OLD_NAME_3" ] || \
   [ "$GIT_AUTHOR_NAME" = "$OLD_NAME_4" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_1" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_2" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_3" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_4" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_5" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_6" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL_7" ]
then
  export GIT_AUTHOR_NAME="Darren McGann"
  export GIT_AUTHOR_EMAIL="dmcgann@msetech.org"
fi

if [ "$GIT_COMMITTER_NAME" = "$OLD_NAME_1" ] || \
   [ "$GIT_COMMITTER_NAME" = "$OLD_NAME_2" ] || \
   [ "$GIT_COMMITTER_NAME" = "$OLD_NAME_3" ] || \
   [ "$GIT_COMMITTER_NAME" = "$OLD_NAME_4" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_1" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_2" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_3" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_4" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_5" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_6" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL_7" ]
then
  export GIT_COMMITTER_NAME="Darren McGann"
  export GIT_COMMITTER_EMAIL="dmcgann@msetech.org"
fi
