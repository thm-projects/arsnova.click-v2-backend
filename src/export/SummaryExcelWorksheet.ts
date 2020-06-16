import * as path from 'path';
import MemberDAO from '../db/MemberDAO';
import { QuestionType } from '../enums/QuestionType';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { settings } from '../statistics';
import { ExcelWorksheet } from './ExcelWorksheet';

declare global {
  namespace xlsx {
    interface IRow {
      filter(config: object): void;

      setHeight(height: number): void;

      setWidth(width: number): void;
    }
  }
}

export class SummaryExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;

  constructor({ wb, theme, translation, quiz, mf, leaderboard, leaderboardGroup }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex: null,
      leaderboard,
      leaderboardGroup
    });

    this._ws = wb.addWorksheet(mf('export.summary'), this._options);

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();

    this.ws.row(1).setHeight(20);
    this.ws.column(1).setWidth(30);
    this.ws.column(2).setWidth(this._isCasRequired ? 10 : this.quiz.sessionConfig.readingConfirmationEnabled ? 25 : 20);
    for (let i = 3; i <= this.columnsToFormat; i++) {
      if (i === this.columnsToFormat) {
        this.ws.column(i).setWidth(70);
      } else {
        this.ws.column(i).setWidth(22);
      }
    }

    this.ws.cell(1, 1, 1, this.columnsToFormat).style(Object.assign({}, defaultStyles.quizNameRowStyle, {
      alignment: {
        vertical: 'center',
      },
    }));
    this.ws.cell(1, this.columnsToFormat - 1).style({
      alignment: {
        horizontal: 'left',
        vertical: 'center',
      },
    });

    this.ws.cell(2, 1, 2, this.columnsToFormat).style(defaultStyles.exportedAtRowStyle);

    this.ws.cell(1, 1, 2, 1).style({
      alignment: {
        indent: 5,
      },
    });

    let currentRowIndex = 6;
    if (this.quiz.sessionConfig.confidenceSliderEnabled) {
      currentRowIndex++;
    }

    this.ws.cell(4, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(4, 3, currentRowIndex, 3).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.cell(this.quiz.sessionConfig.confidenceSliderEnabled ? currentRowIndex - 1 : currentRowIndex, 3, currentRowIndex, 3).style({
      numberFormat: defaultStyles.numberFormat,
    });

    currentRowIndex += 2;

    if (this.quiz.sessionConfig.nicks.memberGroups.length) {
      this.ws.cell(currentRowIndex, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
      this.ws.cell(currentRowIndex, 1).style({
        alignment: {
          horizontal: 'left',
        },
      });

      currentRowIndex++;
      const teamRowsToFormat = currentRowIndex + this.quiz.sessionConfig.nicks.memberGroups.length - 1;
      this.ws.cell(currentRowIndex, 1, teamRowsToFormat, this.columnsToFormat)
        .style(defaultStyles.attendeeEntryRowStyle);

      this.ws.cell(currentRowIndex, 2, teamRowsToFormat, 2).style({
        alignment: {
          horizontal: 'center',
        },
      });

      currentRowIndex += this.quiz.sessionConfig.nicks.memberGroups.length + 1;
    }

    this.ws.cell(currentRowIndex, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.attendeeHeaderGroupRowStyle);
    currentRowIndex++;
    this.ws.cell(currentRowIndex, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(currentRowIndex, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    let dataWithoutCompleteCorrectQuestions = 0;
    await asyncForEach(this.leaderboard, (leaderboardItem) => {
      let hasNotAllQuestionsCorrect = false;
      this.quiz.questionList.forEach((item, index) => {
        if (![
          QuestionType.SurveyQuestion, QuestionType.ABCDSurveyQuestion,
        ].includes(item.TYPE) && leaderboardItem.correctQuestions.indexOf((index)) === -1) {
          hasNotAllQuestionsCorrect = true;
        }
      });
      if (hasNotAllQuestionsCorrect) {
        dataWithoutCompleteCorrectQuestions++;
        return;
      }
      let nextColumnIndex = 2;
      currentRowIndex++;
      if (this.quiz.sessionConfig.confidenceSliderEnabled) {
        this.ws.cell(currentRowIndex, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(currentRowIndex, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
      this.ws.cell(currentRowIndex, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
      this.ws.cell(currentRowIndex, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#',
      });
    });

    if (dataWithoutCompleteCorrectQuestions === this.leaderboard.length) {
      this.ws.cell(++currentRowIndex, 1, currentRowIndex, this.columnsToFormat, true).style(Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
        alignment: {
          horizontal: 'center',
        },
      }));
    } else {
      this.ws.cell(currentRowIndex, 1, (this.leaderboard.length + currentRowIndex - 1 - dataWithoutCompleteCorrectQuestions), this.columnsToFormat)
      .style(defaultStyles.attendeeEntryRowStyle);
    }
    currentRowIndex += 6;

    this.ws.cell(currentRowIndex, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.attendeeHeaderGroupRowStyle);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1, currentRowIndex, this.columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(currentRowIndex, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });
    this.ws.row(currentRowIndex).filter({
      firstRow: currentRowIndex,
      firstColumn: 1,
      lastRow: currentRowIndex,
      lastColumn: this.columnsToFormat,
    });
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1, (this.leaderboard.length + (currentRowIndex - 1)), this.columnsToFormat)
        .style(defaultStyles.attendeeEntryRowStyle);

    this.leaderboard.forEach((leaderboardItem, indexInList) => {
      let nextColumnIndex = 3;
      const targetRow = indexInList + currentRowIndex;
      if (this.quiz.sessionConfig.confidenceSliderEnabled) {
        this.ws.cell(targetRow, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(targetRow, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
      this.ws.cell(targetRow, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#',
      });
      this.ws.cell(targetRow, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
    });
  }

  public async addSheetData(): Promise<void> {
    let currentRowIndex = 1;
    const allResponses: Array<MemberModelItem> = await MemberDAO.getMembersOfQuizForOwner(this.quiz.name);
    const numberOfAttendees = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length;
    const avrgCorrectAnsweredQuestions = ((this.leaderboard.map((x) => {
      return x.correctQuestions.length;
    }).reduce((a, b) => {
      return a + b;
    }, 0) / numberOfAttendees) || 0);

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.quiz_name')}: ${this.quiz.name}`);
    currentRowIndex++;
    this.ws.cell(currentRowIndex, 1).string(this.createdAt);
    currentRowIndex += 2;

    this.addLogoImage();

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.number_attendees')}:`);
    this.ws.cell(currentRowIndex, 3).number((await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_correct_answered_questions')}:`);
    this.ws.cell(currentRowIndex, 3).number(Math.round((avrgCorrectAnsweredQuestions + Number.EPSILON) * 100) / 100);
    currentRowIndex++;

    if (this.quiz.sessionConfig.confidenceSliderEnabled) {
      this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_confidence')}:`);
      const averageConfidencePercentage = (this.leaderboard.filter((x) => {
        return x.confidenceValue > -1;
      }).map((x) => {
        return x.confidenceValue;
      }).reduce((a, b) => {
        return a + b;
      }, 0) / numberOfAttendees
      );
      this.ws.cell(currentRowIndex, 3).number((
        isNaN(averageConfidencePercentage) ? 0 : Math.round(averageConfidencePercentage)
      ));
      currentRowIndex++;
    }

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_response_time')}:`);
    const averageResponseTime = (
                                this.leaderboard.map((x) => {
                                  return x.responseTime;
                                }).reduce((a, b) => {
                                  return a + b;
                                }, 0) / (
                                  numberOfAttendees || 1
                                )
                                ) / this.quiz.questionList.length;
    this.ws.cell(currentRowIndex, 3).number(this.formatMillisToSeconds(averageResponseTime));
    currentRowIndex += 2;
    let nextColumnIndex = 1;

    if (this.quiz.sessionConfig.nicks.memberGroups.length) {
      this.ws.cell(currentRowIndex, nextColumnIndex).string(this.mf('export.team'));
      this.ws.cell(currentRowIndex++, nextColumnIndex + 1).string(this.mf('export.score'));

      this.quiz.sessionConfig.nicks.memberGroups.forEach(memberGroup => {
        const group = this.leaderboardGroup.find(lbGroup => lbGroup._id === memberGroup.name);
        this.ws.cell(currentRowIndex, nextColumnIndex).string(group._id);
        this.ws.cell(currentRowIndex++, nextColumnIndex + 1).number(group.score);
      });
      currentRowIndex += 1;
    }

    this.ws.cell(currentRowIndex, nextColumnIndex).string(this.mf('export.attendee_complete_correct'));
    currentRowIndex += 1;

    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.attendee'));

    if (this._isCasRequired) {
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }

    if (this.quiz.sessionConfig.confidenceSliderEnabled) {
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.average_confidence'));
    }

    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.overall_response_time'));
    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.average_response_time'));
    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.score'));
    currentRowIndex++;

    let nextStartRow = currentRowIndex + 5;
    await asyncForEach(this.leaderboard, async (leaderboardItem, indexInList) => {
      if (this.quiz.questionList.some((item, index) => ![QuestionType.SurveyQuestion, QuestionType.ABCDSurveyQuestion].includes(item.TYPE)
                                                       && leaderboardItem.correctQuestions.indexOf((index)) === -1)) {
        return;
      }
      nextColumnIndex = 1;
      nextStartRow++;
      const targetRow = indexInList + currentRowIndex;
      this.ws.cell(targetRow, nextColumnIndex++).string(leaderboardItem.name);
      if (this._isCasRequired) {
        const profile = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).filter((nick: MemberModelItem) => {
          return nick.name === leaderboardItem.name;
        })[0].casProfile;
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.mail[0]);
      }

      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.confidenceValue));
      }

      // user's response time and avg. response time is added (top list)
      const responseTime = this.formatMillisToSeconds(leaderboardItem.responseTime);
      this.ws.cell(targetRow, nextColumnIndex++).number(responseTime);
      this.ws.cell(targetRow, nextColumnIndex++).number(this.formatMillisToSeconds(responseTime / this.quiz.questionList.length * 1000));
      this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.score));
      nextColumnIndex++;
    });

    if (nextStartRow === currentRowIndex + 5) {
      this.ws.cell(currentRowIndex, 1).string(this.mf('export.attendee_complete_correct_none_available'));
      nextStartRow++;
    }

    nextColumnIndex = 1;
    this.ws.cell(nextStartRow, nextColumnIndex).string(this.mf('export.attendee_all_entries'));
    nextStartRow++;

    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.attendee'));

    if (this._isCasRequired) {
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }

    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.correct_questions'));

    if (this.quiz.sessionConfig.confidenceSliderEnabled) {
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.average_confidence'));
    }

    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.overall_response_time'));
    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.score'));
    this.ws.cell(nextStartRow++, nextColumnIndex++).string(this.mf('export.bonus_token'));

    await asyncForEach(allResponses, async (responseItem, indexInList) => {
      nextColumnIndex = 1;
      const targetRow = indexInList + nextStartRow;
      // name is added to summary (bottom list)
      this.ws.cell(targetRow, nextColumnIndex++).string(responseItem.name);
      if (this._isCasRequired) {
        const profile = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).find((nick: MemberModelItem) => {
          return nick.name === responseItem.name;
        }).casProfile;
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.mail[0]);
      }
      const leaderboardItem = this.leaderboard.find((item) => item.name === responseItem.name);
      if (leaderboardItem) {
        if (leaderboardItem.correctQuestions.length > 0) {
          const correctQuestionNumbers = leaderboardItem.correctQuestions.map((item) => item + 1);
          this.ws.cell(targetRow, nextColumnIndex++).string(correctQuestionNumbers.join(', '));
        }

        if (this.quiz.sessionConfig.confidenceSliderEnabled) {
          this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.confidenceValue));
        }
        // user's response time and avg. response time is added (bottom list)
        const responseTime = this.formatMillisToSeconds(leaderboardItem.responseTime);
        const canNotUseToken = this.quiz.questionList.some((item, index) => {
          return ![QuestionType.SurveyQuestion, QuestionType.ABCDSurveyQuestion].includes(item.TYPE) &&
                 item.requiredForToken &&
                 leaderboardItem.correctQuestions.indexOf((index)) === -1;
        });

        this.ws.cell(targetRow, nextColumnIndex++).number(responseTime);
        this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.score));
        if (!canNotUseToken) {
          this.ws.cell(targetRow, nextColumnIndex++).string(responseItem.bonusToken);
        }
      } else {
        this.ws.cell(targetRow, nextColumnIndex++).string(this.mf('export.correct_questions_none_available'));
      }
    });
  }

  private addLogoImage(): void {
    this.ws.addImage({
      path: path.join(settings.pathToAssets, 'images', settings.logoFilename),
      type: 'picture',
      position: {
        type: 'twoCellAnchor',
        from: {
          col: 1,
          colOff: '1mm',
          row: 1,
          rowOff: '1mm',
        },
        to: {
          col: 1,
          colOff: '13mm',
          row: 2,
          rowOff: '11mm',
        },
      },
    });
  }
}
